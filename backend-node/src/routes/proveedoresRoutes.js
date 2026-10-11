const express = require('express');
const router = express.Router();
const {
    getProveedores,
    createProveedor,
    updateProveedor,
    deleteProveedor
} = require('../controllers/proveedoresController');

router.get('/', getProveedores);
router.post('/', createProveedor);
router.put('/:id', updateProveedor);
router.delete('/:id', deleteProveedor);

module.exports = router;
