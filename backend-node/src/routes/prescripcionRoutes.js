const express = require('express');
const router = express.Router();

const {
    crearPrescripcion,
    obtenerPrescripciones,
    obtenerPrescripcionPorId
} = require('../controllers/prescripcionController');

// Registrar una prescripción
router.post('/', crearPrescripcion);

// Consultar todas las prescripciones
router.get('/', obtenerPrescripciones);

// Consultar prescripción por ID
router.get('/:id', obtenerPrescripcionPorId);

module.exports = router;