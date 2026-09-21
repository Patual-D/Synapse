const { Router } = require('express');
const maintenanceController = require('../controllers/maintenance.controller');
const verifyToken = require('../middleware/verifyToken');
const isAdmin = require('../middleware/isAdmin');

const router = Router();

router.post('/', verifyToken, maintenanceController.report);
router.get('/', verifyToken, maintenanceController.list);
router.patch('/:id', verifyToken, isAdmin, maintenanceController.update);

module.exports = router;