const express = require('express');
const router = express.Router();
const { login, getProfile } = require('../controllers/authControllers');
const { verificarToken } = require('../middlewares/authMiddleware');

router.post('/login', login);
router.get('/profile', verificarToken, getProfile);

module.exports = router;