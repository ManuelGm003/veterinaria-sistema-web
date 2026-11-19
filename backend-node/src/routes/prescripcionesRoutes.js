const express = require('express');
const router = express.Router();
const {
    validarPrescripcion,
    getPrescripciones,
    createPrescripcion,
    updatePrescripcion,
    deletePrescripcion,
    obtenerPrescripcionesPorMascota,
    obtenerPrescripcionesPorEstado,
    anularPrescripcion
} = require('../controllers/prescripcionesController');
const { verificarToken, permitirRoles } = require('../middlewares/authMiddleware');

router.get('/validar/:codigo', verificarToken, permitirRoles('Administrador', 'Cajero'), validarPrescripcion);
router.get('/', verificarToken, permitirRoles('Administrador', 'Cajero'), getPrescripciones);
router.post('/', verificarToken, permitirRoles('Administrador'), createPrescripcion);
router.put('/:id', verificarToken, permitirRoles('Administrador'), updatePrescripcion);
router.delete('/:id', verificarToken, permitirRoles('Administrador'), deletePrescripcion);

router.get('/mascota/:mascotaId', verificarToken, permitirRoles('Administrador', 'Cajero'), obtenerPrescripcionesPorMascota);
router.get('/estado/:estado', verificarToken, permitirRoles('Administrador', 'Cajero'), obtenerPrescripcionesPorEstado);
router.put('/anular/:id', verificarToken, permitirRoles('Administrador'), anularPrescripcion);

module.exports = router;
