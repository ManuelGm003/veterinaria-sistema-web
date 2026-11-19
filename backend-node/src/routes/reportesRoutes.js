const express = require('express');
const router = express.Router();
const { getReporteVentas, getReporteInventario } = require('../controllers/reportesController');
const { verificarToken, permitirRoles } = require('../middlewares/authMiddleware');

router.get('/ventas', verificarToken, permitirRoles('Administrador'), getReporteVentas);
router.get('/inventario', verificarToken, permitirRoles('Administrador', 'Bodeguero'), getReporteInventario);

module.exports = router;
