const express = require('express');
const router = express.Router();
const {
    registrarVenta,
    getVentas,
    getVentaById,
    anularVenta
} = require('../controllers/ventasController');
const { verificarToken, permitirRoles } = require('../middlewares/authMiddleware');

// RF-12 & RF-13: Crear venta
router.post('/', verificarToken, permitirRoles('Administrador', 'Cajero'), registrarVenta);
router.get('/', verificarToken, permitirRoles('Administrador', 'Cajero'), getVentas);
router.get('/:id', verificarToken, permitirRoles('Administrador', 'Cajero'), getVentaById);
router.delete('/:id', verificarToken, permitirRoles('Administrador'), anularVenta);

module.exports = router;