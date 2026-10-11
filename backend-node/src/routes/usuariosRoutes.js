const express = require('express');
const router = express.Router();
const {
    getUsuarios,
    getRoles,
    createUsuario,
    updateUsuario,
    toggleEstadoUsuario
} = require('../controllers/usuariosController');

router.get('/', getUsuarios);
router.get('/roles', getRoles);
router.post('/', createUsuario);
router.put('/:id', updateUsuario);
router.patch('/:id/toggle', toggleEstadoUsuario);

module.exports = router;
