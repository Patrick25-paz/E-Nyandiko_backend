const deviceIdentityService = require('../services/deviceIdentity.service');
const { created, ok } = require('../utils/response');

async function register(req, res, next) {
    try {
        const result = await deviceIdentityService.registerDeviceIdentity({
            userId: req.user?.id,
            deviceTypeId: req.body.deviceTypeId,
            imei: req.body.imei,
            serialNumber: req.body.serialNumber
        });

        return created(res, { message: 'Device registered', data: result });
    } catch (err) {
        return next(err);
    }
}

async function reportStolen(req, res, next) {
    try {
        const result = await deviceIdentityService.reportDeviceStolen({
            userId: req.user?.id,
            deviceTypeId: req.body.deviceTypeId,
            imei: req.body.imei,
            serialNumber: req.body.serialNumber,
            description: req.body.description
        });

        return ok(res, { message: 'Device reported stolen', data: result });
    } catch (err) {
        return next(err);
    }
}

module.exports = {
    register,
    reportStolen
};
