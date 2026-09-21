const { Router } = require('express');
const reservationController = require('../controllers/reservation.controller');
const verifyToken = require('../middleware/verifyToken');

const router = Router();

router.post('/', verifyToken, reservationController.create);
router.get('/', verifyToken, reservationController.list);
router.patch('/:id', verifyToken, reservationController.updateState);

module.exports = router;