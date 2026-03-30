const router = require('express').Router();

const subscriptionController = require('../controllers/subscription.controller');
const auth = require('../middlewares/auth.middleware');
const requireRoles = require('../middlewares/role.middleware');
const validate = require('../middlewares/validate.middleware');

const {
    getSettingsSchema,
    updateSettingsSchema,
    getMySubscriptionSchema,
    createClaimSchema,
    listAdminSellersSchema,
    adminDeleteSellerSchema,
    listClaimsSchema,
    reviewClaimSchema,
    reportSchema
} = require('../validators/subscription.validator');

// Settings
router.get('/settings', auth, validate(getSettingsSchema), subscriptionController.getSettings);
router.put('/settings', auth, requireRoles('ADMIN'), validate(updateSettingsSchema), subscriptionController.updateSettings);

// Seller
router.get('/me', auth, requireRoles('SELLER'), validate(getMySubscriptionSchema), subscriptionController.getMySubscription);
router.post('/claim', auth, requireRoles('SELLER'), validate(createClaimSchema), subscriptionController.createMyClaim);

// Admin
router.get('/admin/sellers', auth, requireRoles('ADMIN'), validate(listAdminSellersSchema), subscriptionController.listAdminSellers);
router.delete(
    '/admin/sellers/:sellerId',
    auth,
    requireRoles('ADMIN'),
    validate(adminDeleteSellerSchema),
    subscriptionController.adminDeleteSeller
);
router.get('/admin/claims', auth, requireRoles('ADMIN'), validate(listClaimsSchema), subscriptionController.listClaims);
router.post('/admin/claims/:id/approve', auth, requireRoles('ADMIN'), validate(reviewClaimSchema), subscriptionController.approveClaim);
router.post('/admin/claims/:id/reject', auth, requireRoles('ADMIN'), validate(reviewClaimSchema), subscriptionController.rejectClaim);
router.get('/admin/report', auth, requireRoles('ADMIN'), validate(reportSchema), subscriptionController.report);

module.exports = router;
