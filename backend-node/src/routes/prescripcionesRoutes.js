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

// Rutas originales de tu compañero (Intactas)
router.get('/validar/:codigo', validarPrescripcion);
router.get('/', getPrescripciones);
router.post('/', createPrescripcion);
router.put('/:id', updatePrescripcion);
router.delete('/:id', deletePrescripcion);

// Tus rutas nuevas agregadas
router.get('/mascota/:mascotaId', obtenerPrescripcionesPorMascota);
router.get('/estado/:estado', obtenerPrescripcionesPorEstado);
router.put('/anular/:id', anularPrescripcion);

module.exports = router;
