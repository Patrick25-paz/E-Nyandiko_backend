const env = require('../config/env');
const { ApiError } = require('../utils/errors');
const deviceRepository = require('../repositories/device.repository');
const { uploadBuffer } = require('./imageUpload.service');

function parseFields(fieldsRaw) {
    if (!fieldsRaw) return {};
    if (typeof fieldsRaw === 'object' && fieldsRaw !== null) return fieldsRaw;

    try {
        const parsed = JSON.parse(fieldsRaw);
        if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) return parsed;
        throw new Error('fields must be an object');
    } catch {
        throw new ApiError(422, 'Invalid fields JSON; expected object like {"brand":"Apple"}');
    }
}

function coerceAndValidateValue(field, value) {
    switch (field.dataType) {
        case 'STRING': {
            if (typeof value !== 'string') throw new ApiError(422, `Field ${field.key} must be a string`);
            return value;
        }
        case 'NUMBER': {
            const num = typeof value === 'number' ? value : Number(value);
            if (Number.isNaN(num)) throw new ApiError(422, `Field ${field.key} must be a number`);
            return num;
        }
        case 'BOOLEAN': {
            if (typeof value === 'boolean') return value;
            if (value === 'true') return true;
            if (value === 'false') return false;
            throw new ApiError(422, `Field ${field.key} must be a boolean`);
        }
        case 'DATE': {
            const d = new Date(value);
            if (Number.isNaN(d.getTime())) throw new ApiError(422, `Field ${field.key} must be a date`);
            return d.toISOString();
        }
        case 'ENUM': {
            if (typeof value !== 'string') throw new ApiError(422, `Field ${field.key} must be a string`);
            const options = Array.isArray(field.options) ? field.options : [];
            if (options.length > 0 && !options.includes(value)) {
                throw new ApiError(422, `Field ${field.key} must be one of: ${options.join(', ')}`);
            }
            return value;
        }
        default:
            throw new ApiError(500, 'Unsupported field type');
    }
}

async function createDevice({ sellerId, deviceTypeId, title, fieldsRaw, files }) {
    if (!sellerId) throw new ApiError(403, 'Seller profile required');

    const deviceType = await deviceRepository.findDeviceTypeWithFields(deviceTypeId);
    if (!deviceType || !deviceType.isActive) throw new ApiError(404, 'Device type not found');

    const fields = parseFields(fieldsRaw);

    const knownFieldsByKey = new Map(deviceType.fields.map((f) => [f.key, f]));

    // Unknown keys
    for (const key of Object.keys(fields)) {
        if (!knownFieldsByKey.has(key)) {
            throw new ApiError(422, `Unknown field: ${key}`);
        }
    }

    // Required fields
    for (const f of deviceType.fields) {
        if (f.required && (fields[f.key] === undefined || fields[f.key] === null || fields[f.key] === '')) {
            throw new ApiError(422, `Missing required field: ${f.key}`);
        }
    }

    const values = [];
    for (const [key, rawValue] of Object.entries(fields)) {
        const field = knownFieldsByKey.get(key);
        const coerced = coerceAndValidateValue(field, rawValue);
        values.push({ deviceFieldId: field.id, value: coerced });
    }

    const device = await deviceRepository.createDeviceWithValues({
        sellerId,
        deviceTypeId,
        title: title || null,
        values
    });

    if (files && files.length > 0) {
        const folder = `${env.CLOUDINARY_FOLDER}/devices/${device.id}`;

        const uploaded = [];
        for (const file of files) {
            const result = await uploadBuffer({
                buffer: file.buffer,
                folder,
                filename: file.originalname.replace(/\.[^.]+$/, '')
            });

            uploaded.push({
                url: result.secure_url,
                publicId: result.public_id,
                bytes: result.bytes,
                width: result.width,
                height: result.height,
                format: result.format
            });
        }

        await deviceRepository.addDeviceImages(device.id, uploaded);
    }

    return device;
}

async function listSellerDevices({ sellerId, limit, skip }) {
    if (!sellerId) throw new ApiError(403, 'Seller profile required');
    return deviceRepository.listDevicesBySeller(sellerId, { limit, skip });
}


async function getSellerDevice({ sellerId, deviceId }) {
    if (!sellerId) throw new ApiError(403, 'Seller profile required');

    const device = await deviceRepository.findDeviceDetailForSeller({ sellerId, deviceId });
    if (!device) throw new ApiError(404, 'Device not found');
    return device;
}

module.exports = {
    createDevice,
    listSellerDevices,
    getSellerDevice
};
