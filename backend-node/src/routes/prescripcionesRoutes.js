const express = require('express');
const router = express.Router();
const pool = require('../config/db');

// 1. READ ALL (Obtener todas las prescripciones con sus datos)
router.get('/', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM prescripcion ORDER BY id DESC');
    res.json(result.rows);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al obtener las prescripciones' });
  }
});

// 2. READ ONE (Obtener una prescripción por ID con sus detalles)
router.get('/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const prescRes = await pool.query('SELECT * FROM prescripcion WHERE id = $1', [id]);
    
    if (prescRes.rows.length === 0) {
      return res.status(404).json({ mensaje: 'Prescripción no encontrada' });
    }

    const detallesRes = await pool.query('SELECT * FROM detalle_prescripcion WHERE id_prescripcion = $1', [id]);

    res.json({
      ...prescRes.rows[0],
      detalles: detallesRes.rows
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al obtener la prescripción' });
  }
});

// 3. VALIDATE (Validar por número de prescripción - RF-13)
router.get('/validar/:codigo', async (req, res) => {
  const { codigo } = req.params;
  try {
    const result = await pool.query(
      'SELECT * FROM prescripcion WHERE numero = $1',
      [codigo]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ 
        valido: false, 
        mensaje: 'La prescripción médica no existe.' 
      });
    }

    return res.json({ 
      valido: true, 
      prescripcion: result.rows[0] 
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al verificar la prescripción' });
  }
});

// 4. CREATE (Registrar una nueva prescripción)
router.post('/', async (req, res) => {
  const { numero, fecha, id_cliente, veterinario, observaciones, detalles } = req.body;
  const client = await pool.connect();

  try {
    await client.query('BEGIN');
    
    const prescRes = await client.query(
      `INSERT INTO prescripcion (numero, fecha, id_cliente, veterinario, observaciones) 
       VALUES ($1, $2, $3, $4, $5) RETURNING id`,
      [numero, fecha || new Date(), id_cliente, veterinario, observaciones]
    );
    
    const prescripcionId = prescRes.rows[0].id;

    if (detalles && detalles.length > 0) {
      for (const det of detalles) {
        await client.query(
          `INSERT INTO detalle_prescripcion (id_prescripcion, id_producto, cantidad, indicaciones) 
           VALUES ($1, $2, $3, $4)`,
          [prescripcionId, det.id_producto, det.cantidad, det.indicaciones]
        );
      }
    }

    await client.query('COMMIT');
    res.status(201).json({ mensaje: 'Prescripción registrada correctamente', id: prescripcionId });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error(error);
    res.status(500).json({ error: 'Error al guardar la prescripción' });
  } finally {
    client.release();
  }
});

// 5. UPDATE (Actualizar una prescripción existente)
router.put('/:id', async (req, res) => {
  const { id } = req.params;
  const { numero, fecha, id_cliente, veterinario, observaciones } = req.body;

  try {
    const result = await pool.query(
      `UPDATE prescripcion 
       SET numero = $1, fecha = $2, id_cliente = $3, veterinario = $4, observaciones = $5 
       WHERE id = $6 RETURNING *`,
      [numero, fecha, id_cliente, veterinario, observaciones, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ mensaje: 'Prescripción no encontrada para actualizar' });
    }

    res.json({ mensaje: 'Prescripción actualizada correctamente', prescripcion: result.rows[0] });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al actualizar la prescripción' });
  }
});

// 6. DELETE (Eliminar una prescripción y sus detalles)
router.delete('/:id', async (req, res) => {
  const { id } = req.params;
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // Primero borramos los detalles asociados
    await client.query('DELETE FROM detalle_prescripcion WHERE id_prescripcion = $1', [id]);

    // Luego borramos la cabecera de la prescripción
    const result = await client.query('DELETE FROM prescripcion WHERE id = $1 RETURNING *', [id]);

    if (result.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ mensaje: 'Prescripción no encontrada para eliminar' });
    }

    await client.query('COMMIT');
    res.json({ mensaje: 'Prescripción y sus detalles eliminados correctamente' });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error(error);
    res.status(500).json({ error: 'Error al eliminar la prescripción' });
  } finally {
    client.release();
  }
});

module.exports = router;