const express = require('express');
const router = express.Router();
const { getConfiguracion, updateConfiguracion } = require('../controllers/configuracionController');

router.get('/', getConfiguracion);
router.put('/', updateConfiguracion);

module.exports = router;
