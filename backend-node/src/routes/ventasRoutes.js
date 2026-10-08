const express = require('express');
const router = express.Router();
const pool = require('../config/db');

// Registrar Venta (POS) con validación de recetas (RF-13) y descuento de stock (RF-08)
router.post('/', async (req, res) => {
  const { id_usuario, total, descuento, metodo_pago, codigo_prescripcion, productos } = req.body;

  if (!productos || productos.length === 0) {
    return res.status(400).json({ error: 'No se enviaron productos en la venta.' });
  }

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // 1. Verificar si algún producto requiere prescripción médica
    let requiereReceta = false;
    for (const item of productos) {
      const prodRes = await client.query(
        'SELECT requiere_prescripcion FROM producto WHERE id = $1',
        [item.id_producto]
      );

      if (prodRes.rows.length > 0 && prodRes.rows[0].requiere_prescripcion) {
        requiereReceta = true;
        break;
      }
    }

    // 2. Si requiere receta, comprobar que exista
    if (requiereReceta) {
      if (!codigo_prescripcion) {
        throw new Error('Uno o más productos requieren receta médica.');
      }

      const prescRes = await client.query(
        'SELECT id FROM prescripcion WHERE numero = $1',
        [codigo_prescripcion]
      );

      if (prescRes.rows.length === 0) {
        throw new Error('La receta médica proporcionada no existe o no es válida.');
      }
    }

    // 3. Registrar la Venta (RF-12)
    const ventaRes = await client.query(
      `INSERT INTO venta (fecha, id_usuario, total, descuento, metodo_pago, estado) 
       VALUES (NOW(), $1, $2, $3, $4, 'COMPLETADA') RETURNING id`,
      [id_usuario, total, descuento || 0, metodo_pago]
    );

    const idVenta = ventaRes.rows[0].id;

    // 4. Registrar Detalle de venta y descuento atómico de stock (RF-08)
    for (const item of productos) {
      const loteRes = await client.query(
        'SELECT cantidad FROM lote WHERE id = $1 FOR UPDATE',
        [item.id_lote]
      );

      if (loteRes.rows.length === 0 || loteRes.rows[0].cantidad < item.cantidad) {
        throw new Error(`Stock insuficiente en el lote para el producto ID ${item.id_producto}.`);
      }

      const subtotal = item.cantidad * item.precio_unitario;
      await client.query(
        `INSERT INTO detalle_venta (id_venta, id_producto, id_lote, cantidad, precio_unitario, subtotal) 
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [idVenta, item.id_producto, item.id_lote, item.cantidad, item.precio_unitario, subtotal]
      );

      // Descontar del lote correspondiente
      await client.query(
        'UPDATE lote SET cantidad = cantidad - $1 WHERE id = $2',
        [item.cantidad, item.id_lote]
      );
    }

    await client.query('COMMIT');
    res.status(201).json({ exito: true, mensaje: 'Venta registrada con éxito', id_venta: idVenta });

  } catch (error) {
    await client.query('ROLLBACK');
    res.status(400).json({ exito: false, error: error.message });
  } finally {
    client.release();
  }
});

module.exports = router;