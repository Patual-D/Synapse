const { Router } = require('express');
const assetController = require('../controllers/asset.controller');
const verifyToken = require('../middleware/verifyToken');
const isAdmin = require('../middleware/isAdmin');

const router = Router();

router.get('/', verifyToken, assetController.list);
router.post('/', verifyToken, isAdmin, assetController.create);

module.exports = router;