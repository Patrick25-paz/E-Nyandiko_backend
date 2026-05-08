const router = require('express').Router();

const deviceTypeController = require('../controllers/deviceType.controller');
const auth = require('../middlewares/auth.middleware');
const requireType = require('../middlewares/type.middleware');
const validate = require('../middlewares/validate.middleware');
const {
    createDeviceTypeSchema,
    createDeviceFieldSchema,
    updateDeviceTypeSchema,
    updateDeviceFieldSchema,
    deleteDeviceTypeSchema,
    deviceFieldParamsSchema
} = require('../validators/deviceType.validator');

router.get('/', deviceTypeController.list);

router.post('/', auth, requireType('ADMIN'), validate(createDeviceTypeSchema), deviceTypeController.createDeviceType);
router.put('/:id', auth, requireType('ADMIN'), validate(updateDeviceTypeSchema), deviceTypeController.updateDeviceType);
router.delete('/:id', auth, requireType('ADMIN'), validate(deleteDeviceTypeSchema), deviceTypeController.deleteDeviceType);

router.post(
    '/:id/fields',
    auth,
    requireType('ADMIN'),
    validate(createDeviceFieldSchema),
    deviceTypeController.addField
);

router.put(
    '/:id/fields/:fieldId',
    auth,
    requireType('ADMIN'),
    validate(updateDeviceFieldSchema),
    deviceTypeController.updateField
);

router.delete(
    '/:id/fields/:fieldId',
    auth,
    requireType('ADMIN'),
    validate(deviceFieldParamsSchema),
    deviceTypeController.deleteField
);

module.exports = router;
