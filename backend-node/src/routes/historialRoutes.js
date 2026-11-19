const express = require('express');
const router = express.Router();
const {
    crearHistorial,
    obtenerHistorialPorPaciente
} = require('../controllers/historialController');
const { verificarToken, permitirRoles } = require('../middlewares/authMiddleware');

router.post('/', verificarToken, permitirRoles('Administrador'), crearHistorial);
router.get('/mascota/:mascotaId', verificarToken, permitirRoles('Administrador', 'Cajero', 'Bodeguero'), obtenerHistorialPorPaciente);
router.get('/paciente/:pacienteId', verificarToken, permitirRoles('Administrador', 'Cajero', 'Bodeguero'), obtenerHistorialPorPaciente);

module.exports = router;

