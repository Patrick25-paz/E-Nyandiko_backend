const router = require('express').Router();

const auth = require('../middlewares/auth.middleware');
const requireType = require('../middlewares/type.middleware');
const validate = require('../middlewares/validate.middleware');
const controller = require('../controllers/deviceIdentity.controller');
const { registerDeviceIdentitySchema, reportStolenSchema } = require('../validators/deviceIdentity.validator');

router.post('/device-identities/register', auth, requireType('ADMIN', 'SHOP', 'INDIVIDUAL'), validate(registerDeviceIdentitySchema), controller.register);
router.post('/device-identities/report-stolen', auth, requireType('ADMIN', 'SHOP', 'INDIVIDUAL'), validate(reportStolenSchema), controller.reportStolen);

module.exports = router;
