const { Router } = require('express');
const authController = require('../controllers/auth.controller');
const verifyToken = require('../middleware/verifyToken');

const router = Router();

router.post('/register', authController.register);
router.post('/login', authController.login);
router.get('/me', verifyToken, authController.me);

module.exports = router;