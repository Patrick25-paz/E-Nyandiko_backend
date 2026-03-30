const router = require('express').Router();

const deviceController = require('../controllers/device.controller');
const auth = require('../middlewares/auth.middleware');
const requireRoles = require('../middlewares/role.middleware');
const validate = require('../middlewares/validate.middleware');
const upload = require('../middlewares/upload.middleware');
const { createDeviceSchema, getDeviceSchema, listDevicesSchema } = require('../validators/device.validator');

router.get('/', auth, requireRoles('SELLER'), validate(listDevicesSchema), deviceController.listMyDevices);
router.get('/:id', auth, requireRoles('SELLER'), validate(getDeviceSchema), deviceController.getMyDevice);

router.post(
    '/',
    auth,
    requireRoles('SELLER'),
    upload.array('images', 5),
    validate(createDeviceSchema),
    deviceController.createDevice
);

module.exports = router;
