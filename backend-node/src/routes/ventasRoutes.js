const express = require('express');
const router = express.Router();
const {
    registrarVenta,
    getVentas,
    getVentaById,
    anularVenta
} = require('../controllers/ventasController');

// RF-12 & RF-13: Crear venta
router.post('/', registrarVenta);
router.get('/', getVentas);
router.get('/:id', getVentaById);
router.delete('/:id', anularVenta);

module.exports = router;