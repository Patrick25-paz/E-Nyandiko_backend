const deviceService = require('../services/device.service');
const { created, ok } = require('../utils/response');

async function createDevice(req, res, next) {
    try {
        const device = await deviceService.createDevice({
            sellerId: req.user.sellerId,
            deviceTypeId: req.body.deviceTypeId,
            title: req.body.title,
            fieldsRaw: req.body.fields,
            files: req.files
        });

        return created(res, { message: 'Device created', data: device });
    } catch (err) {
        return next(err);
    }
}

async function listMyDevices(req, res, next) {
    try {
        const devices = await deviceService.listSellerDevices({
            sellerId: req.user.sellerId,
            limit: req.query.limit,
            skip: req.query.skip
        });
        return ok(res, { message: 'Devices', data: devices });
    } catch (err) {
        return next(err);
    }
}


async function getMyDevice(req, res, next) {
    try {
        const device = await deviceService.getSellerDevice({
            sellerId: req.user.sellerId,
            deviceId: req.params.id
        });
        return ok(res, { message: 'Device', data: device });
    } catch (err) {
        return next(err);
    }
}

module.exports = {
    createDevice,
    listMyDevices,
    getMyDevice
};
