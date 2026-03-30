const { ApiError } = require('../utils/errors');
const deviceTypeRepository = require('../repositories/deviceType.repository');

async function createDeviceType({ name, description }) {
    try {
        return await deviceTypeRepository.createDeviceType({ name, description: description || null });
    } catch (err) {
        if (err.code === 'P2002') throw new ApiError(409, 'Device type already exists');
        throw err;
    }
}

async function addFieldToDeviceType(deviceTypeId, field) {
    const deviceType = await deviceTypeRepository.findDeviceTypeById(deviceTypeId);
    if (!deviceType) throw new ApiError(404, 'Device type not found');

    if (field.dataType === 'ENUM') {
        if (!field.options || field.options.length === 0) {
            throw new ApiError(422, 'ENUM fields must include non-empty options');
        }
    }

    try {
        return await deviceTypeRepository.createDeviceField(deviceTypeId, {
            key: field.key,
            label: field.label,
            dataType: field.dataType,
            required: field.required,
            options: field.options ? field.options : null,
            sortOrder: field.sortOrder
        });
    } catch (err) {
        if (err.code === 'P2002') throw new ApiError(409, 'Field key already exists for this device type');
        throw err;
    }
}

async function listDeviceTypes() {
    return deviceTypeRepository.listDeviceTypes();
}

async function updateDeviceType(deviceTypeId, { name, description }) {
    const deviceType = await deviceTypeRepository.findDeviceTypeById(deviceTypeId);
    if (!deviceType) throw new ApiError(404, 'Device type not found');

    const data = {};
    if (typeof name === 'string') data.name = name;
    if (typeof description === 'string') data.description = description;

    try {
        return await deviceTypeRepository.updateDeviceType(deviceTypeId, data);
    } catch (err) {
        if (err.code === 'P2002') throw new ApiError(409, 'Device type already exists');
        throw err;
    }
}

async function deleteDeviceType(deviceTypeId) {
    const deviceType = await deviceTypeRepository.findDeviceTypeById(deviceTypeId);
    if (!deviceType) throw new ApiError(404, 'Device type not found');

    // We soft-delete by marking inactive (Device.deviceType has onDelete: Restrict).
    return deviceTypeRepository.deactivateDeviceType(deviceTypeId);
}

async function updateDeviceField(deviceTypeId, fieldId, { label, required, options, sortOrder }) {
    const deviceType = await deviceTypeRepository.findDeviceTypeById(deviceTypeId);
    if (!deviceType) throw new ApiError(404, 'Device type not found');

    const existingField = await deviceTypeRepository.findDeviceFieldById(fieldId);
    if (!existingField || existingField.deviceTypeId !== deviceTypeId) {
        throw new ApiError(404, 'Field not found');
    }

    const data = {};
    if (typeof label === 'string') data.label = label;
    if (typeof required === 'boolean') data.required = required;
    if (typeof sortOrder === 'number') data.sortOrder = sortOrder;

    if (existingField.dataType === 'ENUM') {
        if (options !== undefined) {
            if (!Array.isArray(options) || options.length === 0) {
                throw new ApiError(422, 'ENUM fields must include non-empty options');
            }
            data.options = options;
        }
    } else {
        // Non-enum fields should not store options.
        if (options !== undefined) data.options = null;
    }

    return deviceTypeRepository.updateDeviceField(fieldId, data);
}

async function deleteDeviceField(deviceTypeId, fieldId) {
    const deviceType = await deviceTypeRepository.findDeviceTypeById(deviceTypeId);
    if (!deviceType) throw new ApiError(404, 'Device type not found');

    const existingField = await deviceTypeRepository.findDeviceFieldById(fieldId);
    if (!existingField || existingField.deviceTypeId !== deviceTypeId) {
        throw new ApiError(404, 'Field not found');
    }

    const valueCount = await deviceTypeRepository.countDeviceFieldValues(fieldId);
    if (valueCount > 0) {
        throw new ApiError(409, 'Field is already used by devices and cannot be deleted');
    }

    await deviceTypeRepository.deleteDeviceField(fieldId);
    return { id: fieldId };
}

module.exports = {
    createDeviceType,
    addFieldToDeviceType,
    updateDeviceType,
    deleteDeviceType,
    updateDeviceField,
    deleteDeviceField,
    listDeviceTypes
};
