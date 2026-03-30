const router = require('express').Router();
const sellerController = require('../controllers/seller.controller');
const auth = require('../middlewares/auth.middleware');
const requireRoles = require('../middlewares/role.middleware');
const validate = require('../middlewares/validate.middleware');
const upload = require('../middlewares/upload.middleware');
const { updateSellerProfileSchema } = require('../validators/seller.validator');

// Get seller profile
router.get('/profile', auth, requireRoles('SELLER'), sellerController.getProfile);

// Update seller profile
router.patch('/profile', auth, requireRoles('SELLER'), upload.single('logo'), validate(updateSellerProfileSchema), sellerController.updateProfile);

// Get dashboard stats
router.get('/dashboard-stats', auth, requireRoles('SELLER'), sellerController.getDashboardStats);

// Search clients
router.get('/clients/search', auth, requireRoles('SELLER'), sellerController.searchClients);

module.exports = router;
