const express = require('express');
const router = express.Router();
const {
    getProductos,
    getProductoById,
    createProducto,
    updateProducto,
    deleteProducto
} = require('../controllers/productosController');
const { verificarToken, permitirRoles } = require('../middlewares/authMiddleware');

router.get('/', verificarToken, permitirRoles('Administrador', 'Cajero', 'Bodeguero'), getProductos);
router.get('/:id', verificarToken, permitirRoles('Administrador', 'Cajero', 'Bodeguero'), getProductoById);
router.post('/', verificarToken, permitirRoles('Administrador', 'Bodeguero'), createProducto);
router.put('/:id', verificarToken, permitirRoles('Administrador', 'Bodeguero'), updateProducto);
router.delete('/:id', verificarToken, permitirRoles('Administrador'), deleteProducto);

module.exports = router;
