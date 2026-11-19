const express = require('express');
const router = express.Router();
const {
    getCategorias,
    createCategoria,
    updateCategoria,
    deleteCategoria
} = require('../controllers/categoriasController');
const { verificarToken, permitirRoles } = require('../middlewares/authMiddleware');

router.get('/', verificarToken, permitirRoles('Administrador', 'Cajero', 'Bodeguero'), getCategorias);
router.post('/', verificarToken, permitirRoles('Administrador', 'Bodeguero'), createCategoria);
router.put('/:id', verificarToken, permitirRoles('Administrador', 'Bodeguero'), updateCategoria);
router.delete('/:id', verificarToken, permitirRoles('Administrador'), deleteCategoria);

module.exports = router;
