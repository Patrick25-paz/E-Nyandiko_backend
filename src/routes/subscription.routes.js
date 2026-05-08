const router = require('express').Router();

const subscriptionController = require('../controllers/subscription.controller');
const auth = require('../middlewares/auth.middleware');
const requireType = require('../middlewares/type.middleware');
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
router.put('/settings', auth, requireType('ADMIN'), validate(updateSettingsSchema), subscriptionController.updateSettings);

// Seller
router.get('/me', auth, requireType('SHOP'), validate(getMySubscriptionSchema), subscriptionController.getMySubscription);
router.post('/claim', auth, requireType('SHOP'), validate(createClaimSchema), subscriptionController.createMyClaim);

// Admin
router.get('/admin/sellers', auth, requireType('ADMIN'), validate(listAdminSellersSchema), subscriptionController.listAdminSellers);
router.delete(
    '/admin/sellers/:sellerId',
    auth,
    requireType('ADMIN'),
    validate(adminDeleteSellerSchema),
    subscriptionController.adminDeleteSeller
);
router.get('/admin/claims', auth, requireType('ADMIN'), validate(listClaimsSchema), subscriptionController.listClaims);
router.post('/admin/claims/:id/approve', auth, requireType('ADMIN'), validate(reviewClaimSchema), subscriptionController.approveClaim);
router.post('/admin/claims/:id/reject', auth, requireType('ADMIN'), validate(reviewClaimSchema), subscriptionController.rejectClaim);
router.get('/admin/report', auth, requireType('ADMIN'), validate(reportSchema), subscriptionController.report);

module.exports = router;
