const express = require('express');
const router = express.Router();
const { getReporteVentas, getReporteInventario } = require('../controllers/reportesController');

router.get('/ventas', getReporteVentas);
router.get('/inventario', getReporteInventario);

module.exports = router;
