const express = require('express');
const router = express.Router();
const {
    getProveedores,
    createProveedor,
    updateProveedor,
    deleteProveedor
} = require('../controllers/proveedoresController');
const { verificarToken, permitirRoles } = require('../middlewares/authMiddleware');

router.get('/', verificarToken, permitirRoles('Administrador', 'Bodeguero'), getProveedores);
router.post('/', verificarToken, permitirRoles('Administrador', 'Bodeguero'), createProveedor);
router.put('/:id', verificarToken, permitirRoles('Administrador', 'Bodeguero'), updateProveedor);
router.delete('/:id', verificarToken, permitirRoles('Administrador'), deleteProveedor);

module.exports = router;
