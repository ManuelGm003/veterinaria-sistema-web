const express = require('express');
const router = express.Router();
const { getConfiguracion, updateConfiguracion } = require('../controllers/configuracionController');
const { verificarToken, permitirRoles } = require('../middlewares/authMiddleware');

router.get('/', verificarToken, getConfiguracion);
router.put('/', verificarToken, permitirRoles('Administrador'), updateConfiguracion);

module.exports = router;
