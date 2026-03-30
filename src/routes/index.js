const router = require('express').Router();

const healthRoutes = require('./health.routes');
const authRoutes = require('./auth.routes');
const deviceTypeRoutes = require('./deviceType.routes');
const deviceRoutes = require('./device.routes');
const agreementRoutes = require('./agreement.routes');
const sellerRoutes = require('./seller.routes');
const subscriptionRoutes = require('./subscription.routes');

router.use(healthRoutes);
router.use('/auth', authRoutes);
router.use('/device-types', deviceTypeRoutes);
router.use('/devices', deviceRoutes);
router.use('/agreements', agreementRoutes);
router.use('/sellers', sellerRoutes);
router.use('/subscriptions', subscriptionRoutes);

module.exports = router;
