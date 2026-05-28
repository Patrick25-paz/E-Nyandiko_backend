const env = require('../config/env');
const { ApiError } = require('../utils/errors');
const deviceRepository = require('../repositories/device.repository');
const authRepository = require('../repositories/auth.repository');
const sellerRepository = require('../repositories/seller.repository');
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

function formatSellerLocation(data) {
    if (!data) return null;

    const parts = [
        data.province,
        data.district,
        data.sector,
        data.cell,
        data.village
    ].filter(Boolean);

    const extras = [
        data.noticeableName ? `Near ${data.noticeableName}` : null,
        data.houseName ? `House: ${data.houseName}` : null,
        data.floor ? `Floor: ${data.floor}` : null
    ].filter(Boolean);

    const base = parts.join(', ');
    const extra = extras.length ? ` (${extras.join(', ')})` : '';
    return (base || extra) ? `${base}${extra}`.trim() : (data.location || null);
}

async function resolveSellerContext({ userId, sellerId }) {
    const user = await authRepository.findUserById(userId);
    if (!user) throw new ApiError(404, 'User not found');

    if (!['SHOP', 'INDIVIDUAL'].includes(user.type)) {
        throw new ApiError(403, 'Seller profile required');
    }

    if (sellerId) {
        return { sellerId, user };
    }

    const seller = await authRepository.createSellerProfile(userId);
    return { sellerId: seller.id, user };
}

async function createDevice({ userId, sellerId, deviceTypeId, title, fieldsRaw, files }) {
    const sellerContext = await resolveSellerContext({ userId, sellerId });
    const effectiveSellerId = sellerContext.sellerId;
    const user = sellerContext.user;

    if (user.type === 'INDIVIDUAL') {
        const activeDeviceCount = await deviceRepository.countActiveDevicesBySeller(effectiveSellerId);
        if (activeDeviceCount >= 1) {
            throw new ApiError(409, 'Individual users can only register one active device');
        }
    }

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
        sellerId: effectiveSellerId,
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

async function listSellerDevices({ userId, sellerId, limit, skip }) {
    const sellerContext = await resolveSellerContext({ userId, sellerId });
    return deviceRepository.listDevicesBySeller(sellerContext.sellerId, { limit, skip });
}

async function updateSellerDevice({ userId, sellerId, deviceId, title }) {
    const sellerContext = await resolveSellerContext({ userId, sellerId });

    const device = await deviceRepository.findDeviceById(deviceId);
    if (!device || device.sellerId !== sellerContext.sellerId) {
        throw new ApiError(404, 'Device not found');
    }

    if (device.status === 'SOLD') {
        throw new ApiError(409, 'Sold devices cannot be edited');
    }

    const normalizedTitle = typeof title === 'string' ? title.trim() : '';
    if (normalizedTitle.length < 2) {
        throw new ApiError(422, 'Title is required');
    }

    return deviceRepository.updateDeviceTitleBySeller({
        deviceId,
        title: normalizedTitle
    });
}

async function deleteSellerDevice({ userId, sellerId, deviceId }) {
    const sellerContext = await resolveSellerContext({ userId, sellerId });

    const device = await deviceRepository.findDeviceById(deviceId);
    if (!device || device.sellerId !== sellerContext.sellerId) {
        throw new ApiError(404, 'Device not found');
    }

    if (device.status === 'SOLD') {
        throw new ApiError(409, 'Sold devices cannot be deleted');
    }

    try {
        await deviceRepository.deleteDeviceBySeller({ deviceId });
    } catch (err) {
        if (err?.code === 'P2003') {
            throw new ApiError(409, 'This device cannot be deleted because it has related records or an agreement');
        }
        throw err;
    }

    return { deleted: true };
}


async function getSellerDevice({ userId, sellerId, deviceId }) {
    const sellerContext = await resolveSellerContext({ userId, sellerId });

    const device = await deviceRepository.findDeviceDetailForSeller({ sellerId: sellerContext.sellerId, deviceId });
    if (!device) throw new ApiError(404, 'Device not found');
    return device;
}

async function grantDeviceExchangeAccess({ userId, sellerId, deviceId, grantedToSellerId }) {
    const sellerContext = await resolveSellerContext({ userId, sellerId });

    if (sellerContext.user.type !== 'INDIVIDUAL') {
        throw new ApiError(403, 'Only individual users can grant exchange access');
    }

    const device = await deviceRepository.findDeviceDetailForSeller({
        sellerId: sellerContext.sellerId,
        deviceId
    });
    if (!device) throw new ApiError(404, 'Device not found');
    if (device.status !== 'ACTIVE') throw new ApiError(409, 'Only active devices can be shared for exchange');

    if (device.exchangeAccess && device.exchangeAccess.grantedToSellerId && device.exchangeAccess.grantedToSellerId !== grantedToSellerId) {
        throw new ApiError(409, 'This device is already granted to another shop. Cancel the grant first.');
    }

    const pendingAgreement = (device.agreements || []).find((agreement) => agreement.status === 'PENDING');
    if (pendingAgreement) {
        throw new ApiError(409, 'This device already has a pending agreement');
    }

    const targetSeller = await sellerRepository.findSellerById(grantedToSellerId);
    if (!targetSeller || targetSeller.user?.type !== 'SHOP') {
        throw new ApiError(404, 'Shop not found');
    }

    if (targetSeller.id === sellerContext.sellerId) {
        throw new ApiError(409, 'You cannot grant exchange access to your own account');
    }

    return deviceRepository.upsertDeviceExchangeAccess({
        deviceId,
        ownerSellerId: sellerContext.sellerId,
        grantedToSellerId
    });
}

async function revokeDeviceExchangeAccess({ userId, sellerId, deviceId }) {
    const sellerContext = await resolveSellerContext({ userId, sellerId });

    if (sellerContext.user.type !== 'INDIVIDUAL') {
        throw new ApiError(403, 'Only individual users can revoke exchange access');
    }

    const device = await deviceRepository.findDeviceDetailForSeller({
        sellerId: sellerContext.sellerId,
        deviceId
    });
    if (!device) throw new ApiError(404, 'Device not found');

    if (!device.exchangeAccess) {
        return { revoked: false };
    }

    const pendingAgreement = (device.agreements || []).find((agreement) => agreement.status === 'PENDING');
    if (pendingAgreement) {
        throw new ApiError(409, 'This device has a pending agreement');
    }

    await deviceRepository.deleteExchangeAccessByDeviceId(deviceId);
    return { revoked: true };
}

async function listSharedExchangeDevices({ userId, sellerId }) {
    const sellerContext = await resolveSellerContext({ userId, sellerId });

    if (sellerContext.user.type !== 'SHOP') {
        throw new ApiError(403, 'Only shop users can access shared exchange devices');
    }

    const shared = await deviceRepository.listSharedDevicesForSeller(sellerContext.sellerId);
    return shared.map((entry) => ({
        accessId: entry.id,
        sharedAt: entry.updatedAt,
        device: {
            ...entry.device,
            owner: {
                sellerId: entry.device.seller?.id || null,
                businessName: entry.device.seller?.businessName || null,
                phone: entry.device.seller?.phone || entry.device.seller?.user?.phone || null,
                location: formatSellerLocation(entry.device.seller),
                user: {
                    id: entry.device.seller?.user?.id || null,
                    fullName: entry.device.seller?.user?.fullName || null,
                    email: entry.device.seller?.user?.email || null,
                    nationalId: entry.device.seller?.user?.nationalId || null,
                    phone: entry.device.seller?.user?.phone || null
                }
            }
        }
    }));
}

module.exports = {
    createDevice,
    listSellerDevices,
    updateSellerDevice,
    deleteSellerDevice,
    getSellerDevice,
    grantDeviceExchangeAccess,
    revokeDeviceExchangeAccess,
    listSharedExchangeDevices
};
