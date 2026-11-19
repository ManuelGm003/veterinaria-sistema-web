const express = require('express');
const router = express.Router();
const { getDashboardStats } = require('../controllers/dashboardController');
const { verificarToken, permitirRoles } = require('../middlewares/authMiddleware');

router.get('/', verificarToken, permitirRoles('Administrador', 'Cajero', 'Bodeguero'), getDashboardStats);

module.exports = router;
