const express = require('express');
const router = express.Router();
const {
    registrarEntrada,
    getEntradas,
    getLotes,
    ajustarLote
} = require('../controllers/inventarioController');
const { verificarToken, permitirRoles } = require('../middlewares/authMiddleware');

router.post('/entradas', verificarToken, permitirRoles('Administrador', 'Bodeguero'), registrarEntrada);
router.get('/entradas', verificarToken, permitirRoles('Administrador', 'Bodeguero'), getEntradas);
router.get('/lotes', verificarToken, permitirRoles('Administrador', 'Bodeguero', 'Cajero'), getLotes);
router.put('/lotes/:id/ajuste', verificarToken, permitirRoles('Administrador', 'Bodeguero'), ajustarLote);

module.exports = router;
