const deviceService = require('../services/device.service');
const { created, ok } = require('../utils/response');

async function createDevice(req, res, next) {
    try {
        const device = await deviceService.createDevice({
            userId: req.user.id,
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
            userId: req.user.id,
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
            userId: req.user.id,
            sellerId: req.user.sellerId,
            deviceId: req.params.id
        });
        return ok(res, { message: 'Device', data: device });
    } catch (err) {
        return next(err);
    }
}

async function updateMyDevice(req, res, next) {
    try {
        const device = await deviceService.updateSellerDevice({
            userId: req.user.id,
            sellerId: req.user.sellerId,
            deviceId: req.params.id,
            title: req.body.title
        });
        return ok(res, { message: 'Device updated', data: device });
    } catch (err) {
        return next(err);
    }
}

async function deleteMyDevice(req, res, next) {
    try {
        const result = await deviceService.deleteSellerDevice({
            userId: req.user.id,
            sellerId: req.user.sellerId,
            deviceId: req.params.id
        });
        return ok(res, { message: 'Device deleted', data: result });
    } catch (err) {
        return next(err);
    }
}

async function grantExchangeAccess(req, res, next) {
    try {
        const result = await deviceService.grantDeviceExchangeAccess({
            userId: req.user.id,
            sellerId: req.user.sellerId,
            deviceId: req.params.id,
            grantedToSellerId: req.body.grantedToSellerId
        });
        return ok(res, { message: 'Exchange access granted', data: result });
    } catch (err) {
        return next(err);
    }
}

async function revokeExchangeAccess(req, res, next) {
    try {
        const result = await deviceService.revokeDeviceExchangeAccess({
            userId: req.user.id,
            sellerId: req.user.sellerId,
            deviceId: req.params.id
        });
        return ok(res, { message: 'Exchange access revoked', data: result });
    } catch (err) {
        return next(err);
    }
}

async function listSharedExchangeDevices(req, res, next) {
    try {
        const devices = await deviceService.listSharedExchangeDevices({
            userId: req.user.id,
            sellerId: req.user.sellerId
        });
        return ok(res, { message: 'Shared exchange devices', data: devices });
    } catch (err) {
        return next(err);
    }
}

module.exports = {
    createDevice,
    listMyDevices,
    getMyDevice,
    updateMyDevice,
    deleteMyDevice,
    grantExchangeAccess,
    revokeExchangeAccess,
    listSharedExchangeDevices
};
