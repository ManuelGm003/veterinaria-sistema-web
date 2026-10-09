const express = require('express');
const router = express.Router();
const pool = require('../config/db');

// 1. CREATE (Procesar Venta / POS - RF-12)
router.post('/', async (req, res) => {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const { cliente_id, prescripcion_id, total, detalles } = req.body;

        const ventaRes = await client.query(
            `INSERT INTO ventas (cliente_id, prescripcion_id, total) VALUES ($1, $2, $3) RETURNING id`,
            [cliente_id, prescripcion_id, total]
        );
        const ventaId = ventaRes.rows[0].id;

        if (detalles && detalles.length > 0) {
            for (let item of detalles) {
                await client.query(
                    `INSERT INTO detalle_ventas (venta_id, producto_id, lote_id, cantidad, precio_unitario, subtotal) 
                     VALUES ($1, $2, $3, $4, $5, $6)`,
                    [ventaId, item.producto_id, item.lote_id, item.cantidad, item.precio_unitario, item.cantidad * item.precio_unitario]
                );

                // Descontar el stock correspondiente del lote
                await client.query(
                    `UPDATE lotes SET cantidad = cantidad - $1 WHERE id = $2`,
                    [item.cantidad, item.lote_id]
                );
            }
        }

        await client.query('COMMIT');
        res.status(201).json({ mensaje: 'Venta registrada con éxito', ventaId });
    } catch (error) {
        await client.query('ROLLBACK');
        console.error(error);
        res.status(500).json({ error: 'Error al procesar la venta' });
    } finally {
        client.release();
    }
});

// 2. READ ALL (Obtener historial de todas las ventas)
router.get('/', async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM ventas ORDER BY id DESC');
        res.json(result.rows);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error al obtener las ventas' });
    }
});

// 3. READ ONE (Obtener una venta por ID con sus detalles)
router.get('/:id', async (req, res) => {
    const { id } = req.params;
    try {
        const ventaRes = await pool.query('SELECT * FROM ventas WHERE id = $1', [id]);
        if (ventaRes.rows.length === 0) {
            return res.status(404).json({ mensaje: 'Venta no encontrada' });
        }
        const detallesRes = await pool.query('SELECT * FROM detalle_ventas WHERE venta_id = $1', [id]);

        res.json({
            ...ventaRes.rows[0],
            detalles: detallesRes.rows
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error al obtener el detalle de la venta' });
    }
});

// 4. DELETE (Anular/Eliminar una venta por ID)
router.delete('/:id', async (req, res) => {
    const { id } = req.params;
    try {
        const result = await pool.query('DELETE FROM ventas WHERE id = $1 RETURNING *', [id]);
        if (result.rows.length === 0) {
            return res.status(404).json({ mensaje: 'Venta no encontrada' });
        }
        res.json({ mensaje: 'Venta anulada correctamente' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error al anular la venta' });
    }
});

module.exports = router;