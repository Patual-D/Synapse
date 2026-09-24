const { Router } = require('express');
const assetController = require('../controllers/asset.controller');
const verifyToken = require('../middleware/verifyToken');
const isAdmin = require('../middleware/isAdmin');

const router = Router();

router.get('/', verifyToken, assetController.list);
router.post('/', verifyToken, isAdmin, assetController.create);
router.patch('/:id', verifyToken, isAdmin, assetController.update);
router.delete('/:id', verifyToken, isAdmin, assetController.remove);

module.exports = router;