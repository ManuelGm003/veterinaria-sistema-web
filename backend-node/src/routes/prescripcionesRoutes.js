const express = require('express');
const router = express.Router();
const pool = require('../config/db');

// Validar si existe una prescripción (RF-13)
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

// Registrar una nueva prescripción
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

module.exports = router;