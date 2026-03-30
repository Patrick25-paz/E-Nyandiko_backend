const deviceTypeService = require('../services/deviceType.service');
const { created, ok } = require('../utils/response');

async function createDeviceType(req, res, next) {
    try {
        const deviceType = await deviceTypeService.createDeviceType(req.body);
        return created(res, { message: 'Device type created', data: deviceType });
    } catch (err) {
        return next(err);
    }
}

async function addField(req, res, next) {
    try {
        const field = await deviceTypeService.addFieldToDeviceType(req.params.id, req.body);
        return created(res, { message: 'Field created', data: field });
    } catch (err) {
        return next(err);
    }
}

async function updateDeviceType(req, res, next) {
    try {
        const deviceType = await deviceTypeService.updateDeviceType(req.params.id, req.body);
        return ok(res, { message: 'Device type updated', data: deviceType });
    } catch (err) {
        return next(err);
    }
}

async function deleteDeviceType(req, res, next) {
    try {
        const deviceType = await deviceTypeService.deleteDeviceType(req.params.id);
        return ok(res, { message: 'Device type deleted', data: deviceType });
    } catch (err) {
        return next(err);
    }
}

async function updateField(req, res, next) {
    try {
        const field = await deviceTypeService.updateDeviceField(req.params.id, req.params.fieldId, req.body);
        return ok(res, { message: 'Field updated', data: field });
    } catch (err) {
        return next(err);
    }
}

async function deleteField(req, res, next) {
    try {
        const result = await deviceTypeService.deleteDeviceField(req.params.id, req.params.fieldId);
        return ok(res, { message: 'Field deleted', data: result });
    } catch (err) {
        return next(err);
    }
}

async function list(req, res, next) {
    try {
        const types = await deviceTypeService.listDeviceTypes();
        return ok(res, { message: 'Device types', data: types });
    } catch (err) {
        return next(err);
    }
}

module.exports = {
    createDeviceType,
    addField,
    updateDeviceType,
    deleteDeviceType,
    updateField,
    deleteField,
    list
};
