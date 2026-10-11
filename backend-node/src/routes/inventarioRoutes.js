const express = require('express');
const router = express.Router();
const {
    registrarEntrada,
    getEntradas,
    getLotes,
    ajustarLote
} = require('../controllers/inventarioController');

router.post('/entradas', registrarEntrada);
router.get('/entradas', getEntradas);
router.get('/lotes', getLotes);
router.put('/lotes/:id/ajuste', ajustarLote);

module.exports = router;
