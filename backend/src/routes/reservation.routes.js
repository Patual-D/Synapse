const { Router } = require('express');
const reservationController = require('../controllers/reservation.controller');
const verifyToken = require('../middleware/verifyToken');
const isAdmin = require('../middleware/isAdmin');

const router = Router();

router.post('/', verifyToken, reservationController.create);
router.get('/', verifyToken, reservationController.list);
router.post('/:id/cancel', verifyToken, reservationController.cancel);
router.patch('/:id', verifyToken, isAdmin, reservationController.updateState);

module.exports = router;