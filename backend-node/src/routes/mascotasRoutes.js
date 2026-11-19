const express = require('express');
const router = express.Router();
const {
    getMascotas,
    getMascotaById,
    createMascota,
    updateMascota
} = require('../controllers/mascotasController');
const { verificarToken, permitirRoles } = require('../middlewares/authMiddleware');

router.get('/', verificarToken, permitirRoles('Administrador', 'Cajero', 'Bodeguero'), getMascotas);
router.get('/:id', verificarToken, permitirRoles('Administrador', 'Cajero', 'Bodeguero'), getMascotaById);
router.post('/', verificarToken, permitirRoles('Administrador'), createMascota);
router.put('/:id', verificarToken, permitirRoles('Administrador'), updateMascota);

module.exports = router;
