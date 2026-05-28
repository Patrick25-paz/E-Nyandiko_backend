const router = require('express').Router();

const deviceController = require('../controllers/device.controller');
const auth = require('../middlewares/auth.middleware');
const requireType = require('../middlewares/type.middleware');
const validate = require('../middlewares/validate.middleware');
const upload = require('../middlewares/upload.middleware');
const { createDeviceSchema, deleteDeviceSchema, getDeviceSchema, grantDeviceExchangeAccessSchema, revokeDeviceExchangeAccessSchema, listDevicesSchema, updateDeviceSchema } = require('../validators/device.validator');

router.get('/', auth, requireType('SHOP', 'INDIVIDUAL'), validate(listDevicesSchema), deviceController.listMyDevices);
router.get('/shared/exchange-access', auth, requireType('SHOP'), deviceController.listSharedExchangeDevices);
router.get('/:id', auth, requireType('SHOP', 'INDIVIDUAL'), validate(getDeviceSchema), deviceController.getMyDevice);
router.patch('/:id', auth, requireType('SHOP', 'INDIVIDUAL'), validate(updateDeviceSchema), deviceController.updateMyDevice);
router.delete('/:id', auth, requireType('SHOP', 'INDIVIDUAL'), validate(deleteDeviceSchema), deviceController.deleteMyDevice);
router.post('/:id/exchange-access', auth, requireType('INDIVIDUAL'), validate(grantDeviceExchangeAccessSchema), deviceController.grantExchangeAccess);
router.delete('/:id/exchange-access', auth, requireType('INDIVIDUAL'), validate(revokeDeviceExchangeAccessSchema), deviceController.revokeExchangeAccess);

router.post(
    '/',
    auth,
    requireType('SHOP', 'INDIVIDUAL'),
    upload.array('images', 5),
    validate(createDeviceSchema),
    deviceController.createDevice
);

module.exports = router;
