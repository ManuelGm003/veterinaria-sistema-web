const express = require('express');
const router = express.Router();
const { login, getProfile } = require('../controllers/authControllers');

router.post('/login', login);
router.get('/profile', getProfile);

module.exports = router;