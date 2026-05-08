const router = require('express').Router();
const sellerController = require('../controllers/seller.controller');
const auth = require('../middlewares/auth.middleware');
const requireType = require('../middlewares/type.middleware');
const validate = require('../middlewares/validate.middleware');
const upload = require('../middlewares/upload.middleware');
const { updateSellerProfileSchema } = require('../validators/seller.validator');

// Get seller profile
router.get('/profile', auth, requireType('SHOP', 'INDIVIDUAL'), sellerController.getProfile);

// Update seller profile
router.patch('/profile', auth, requireType('SHOP', 'INDIVIDUAL'), upload.single('logo'), validate(updateSellerProfileSchema), sellerController.updateProfile);

// Get dashboard stats
router.get('/dashboard-stats', auth, requireType('SHOP', 'INDIVIDUAL'), sellerController.getDashboardStats);

// Search clients
router.get('/clients/search', auth, requireType('SHOP', 'INDIVIDUAL'), sellerController.searchClients);

// Search shops
router.get('/shops/search', auth, requireType('SHOP', 'INDIVIDUAL'), sellerController.searchShops);

module.exports = router;
