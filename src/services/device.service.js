const env = require('../config/env');
const { ApiError } = require('../utils/errors');
const { prisma } = require('../config/database');
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
        const activeDeviceCount = await deviceRepository.countActiveDevicesBySellerAndType(effectiveSellerId, deviceTypeId);
        if (activeDeviceCount >= 2) {
            throw new ApiError(409, 'Individual accounts can register a maximum of 2 active devices per device type. Please shift to use the SHOP account or wait the reset.');
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
        
        if (field.isUnique && rawValue !== undefined && rawValue !== null && rawValue !== '') {
            const duplicate = await prisma.deviceFieldValue.findFirst({
                where: {
                    deviceFieldId: field.id,
                    value: coerced
                }
            });
            if (duplicate) {
                throw new ApiError(409, `A device with this ${field.label} already exists: "${rawValue}"`);
            }
        }

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

        const uploaded = await Promise.all(
            files.map((file) =>
                uploadBuffer({
                    buffer: file.buffer,
                    folder,
                    filename: file.originalname.replace(/\.[^.]+$/, '')
                }).then((result) => ({
                    url: result.secure_url,
                    publicId: result.public_id,
                    bytes: result.bytes,
                    width: result.width,
                    height: result.height,
                    format: result.format
                }))
            )
        );

        await deviceRepository.addDeviceImages(device.id, uploaded);
    }

    return device;
}

async function listSellerDevices({ userId, sellerId, limit, skip }) {
    const sellerContext = await resolveSellerContext({ userId, sellerId });
    return deviceRepository.listDevicesBySeller(sellerContext.sellerId, { limit, skip });
}

async function updateSellerDevice({ userId, sellerId, deviceId, title, fieldsRaw, files }) {
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

    const deviceType = await deviceRepository.findDeviceTypeWithFields(device.deviceTypeId);
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

        if (field.isUnique && rawValue !== undefined && rawValue !== null && rawValue !== '') {
            const duplicate = await prisma.deviceFieldValue.findFirst({
                where: {
                    deviceFieldId: field.id,
                    value: coerced,
                    deviceId: { not: deviceId }
                }
            });
            if (duplicate) {
                throw new ApiError(409, `A device with this ${field.label} already exists: "${rawValue}"`);
            }
        }

        values.push({ deviceFieldId: field.id, value: coerced });
    }

    const updatedDevice = await deviceRepository.updateDeviceWithValues({
        deviceId,
        title: normalizedTitle,
        values
    });

    if (files && files.length > 0) {
        await deviceRepository.deleteDeviceImages(deviceId);

        const folder = `${env.CLOUDINARY_FOLDER}/devices/${deviceId}`;

        const uploaded = await Promise.all(
            files.map((file) =>
                uploadBuffer({
                    buffer: file.buffer,
                    folder,
                    filename: file.originalname.replace(/\.[^.]+$/, '')
                }).then((result) => ({
                    url: result.secure_url,
                    publicId: result.public_id,
                    bytes: result.bytes,
                    width: result.width,
                    height: result.height,
                    format: result.format
                }))
            )
        );

        await deviceRepository.addDeviceImages(deviceId, uploaded);
    }

    return updatedDevice;
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

    if (sellerContext.user.type === 'INDIVIDUAL') {
        const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;
        const FIFTEEN_DAYS_MS = 15 * 24 * 60 * 60 * 1000;

        const deviceGrantsCount = await deviceRepository.countGrantsForDeviceInPeriod(deviceId, FIFTEEN_DAYS_MS);
        const typeGrantsCount = await deviceRepository.countGrantsForSellerAndTypeInPeriod(
            sellerContext.sellerId,
            device.deviceType.id,
            THIRTY_DAYS_MS
        );

        device.limitStatus = {
            deviceGrantsCount,
            typeGrantsCount,
            deviceLimitReached: deviceGrantsCount >= 10,
            typeLimitReached: typeGrantsCount >= 20,
            limitReached: deviceGrantsCount >= 10 || typeGrantsCount >= 20,
            message: 'You can only create those in that period for the current individual account. Please shift to use the SHOP account or wait the reset.'
        };
    }

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

    // Limit check: rolling 15 days and 30 days
    const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;
    const FIFTEEN_DAYS_MS = 15 * 24 * 60 * 60 * 1000;

    // Check 1: Max 10 offers per device in 15 days
    const deviceGrantsCount = await deviceRepository.countGrantsForDeviceInPeriod(deviceId, FIFTEEN_DAYS_MS);
    if (deviceGrantsCount >= 10) {
        throw new ApiError(409, 'You can only create those in that period for the current individual account. Please shift to use the SHOP account or wait the reset.');
    }

    // Check 2: Max 20 offers per device type in 30 days (1 month)
    const typeGrantsCount = await deviceRepository.countGrantsForSellerAndTypeInPeriod(sellerContext.sellerId, device.deviceType.id, THIRTY_DAYS_MS);
    if (typeGrantsCount >= 20) {
        throw new ApiError(409, 'You can only create those in that period for the current individual account. Please shift to use the SHOP account or wait the reset.');
    }

    const pendingAgreement = (device.agreements || []).find((agreement) => agreement.status === 'PENDING');
    if (pendingAgreement) {
        throw new ApiError(409, 'This device already has a pending agreement');
    }

    let targetSeller = await sellerRepository.findSellerById(grantedToSellerId);
    if (!targetSeller) {
        const userSeller = await sellerRepository.findSellerByUserId(grantedToSellerId);
        if (userSeller) {
            targetSeller = await sellerRepository.findSellerById(userSeller.id);
        } else {
            const targetUser = await authRepository.findUserById(grantedToSellerId);
            if (targetUser && ['SHOP', 'INDIVIDUAL'].includes(targetUser.type)) {
                const newSeller = await authRepository.createSellerProfile(targetUser.id);
                targetSeller = await sellerRepository.findSellerById(newSeller.id);
            }
        }
    }

    if (!targetSeller || !['SHOP', 'INDIVIDUAL'].includes(targetSeller.user?.type)) {
        throw new ApiError(404, 'Recipient shop or individual not found');
    }

    const resolvedGrantedToSellerId = targetSeller.id;

    if (device.exchangeAccess && device.exchangeAccess.grantedToSellerId && device.exchangeAccess.grantedToSellerId !== resolvedGrantedToSellerId) {
        throw new ApiError(409, 'This device is already granted to another recipient. Cancel the grant first.');
    }

    if (resolvedGrantedToSellerId === sellerContext.sellerId) {
        throw new ApiError(409, 'You cannot grant exchange access to your own account');
    }

    const access = await deviceRepository.upsertDeviceExchangeAccess({
        deviceId,
        ownerSellerId: sellerContext.sellerId,
        grantedToSellerId: resolvedGrantedToSellerId
    });

    // Log the grant to history
    await deviceRepository.createDeviceExchangeAccessHistory({
        deviceId,
        ownerSellerId: sellerContext.sellerId,
        grantedToSellerId: resolvedGrantedToSellerId,
        deviceTypeId: device.deviceType.id
    });

    return access;
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

async function listSharedExchangeDevices({ userId, sellerId, limit, skip }) {
    const sellerContext = await resolveSellerContext({ userId, sellerId });

    if (sellerContext.user.type !== 'SHOP') {
        throw new ApiError(403, 'Only shop users can access shared exchange devices');
    }

    const shared = await deviceRepository.listSharedDevicesForSeller(sellerContext.sellerId, { limit, skip });
    return shared.map((entry) => ({
        accessId: entry.id,
        sharedAt: entry.updatedAt,
        device: {
            ...entry.device,
            owner: {
                sellerId: entry.device.seller?.id || null,
                businessName: entry.device.seller?.businessName || null,
                phone: entry.device.seller?.phone || entry.device.seller?.user?.phone || null,
                location: formatSellerLocation(entry.device.seller) || formatSellerLocation(entry.device.seller?.user),
                user: {
                    id: entry.device.seller?.user?.id || null,
                    fullName: entry.device.seller?.user?.fullName || null,
                    email: entry.device.seller?.user?.email || null,
                    nationalId: entry.device.seller?.user?.nationalId || null,
                    phone: entry.device.seller?.user?.phone || null,
                    profileImageUrl: entry.device.seller?.user?.profileImageUrl || null,
                    photoUrl: entry.device.seller?.user?.profileImageUrl || null,
                    location: entry.device.seller?.user?.location || formatSellerLocation(entry.device.seller?.user) || null,
                    province: entry.device.seller?.user?.province || null,
                    district: entry.device.seller?.user?.district || null,
                    sector: entry.device.seller?.user?.sector || null,
                    cell: entry.device.seller?.user?.cell || null,
                    village: entry.device.seller?.user?.village || null,
                    noticeableName: entry.device.seller?.user?.noticeableName || null,
                    houseName: entry.device.seller?.user?.houseName || null,
                    floor: entry.device.seller?.user?.floor || null
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
