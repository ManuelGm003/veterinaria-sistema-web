const express = require('express');
const router = express.Router();
const {
    validarPrescripcion,
    getPrescripciones,
    createPrescripcion,
    updatePrescripcion,
    deletePrescripcion
} = require('../controllers/prescripcionesController');

// RF-13: Ruta de validación
router.get('/validar/:codigo', validarPrescripcion);

router.get('/', getPrescripciones);
router.post('/', createPrescripcion);
router.put('/:id', updatePrescripcion);
router.delete('/:id', deletePrescripcion);

module.exports = router;