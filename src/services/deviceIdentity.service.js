const { ApiError } = require('../utils/errors');
const deviceIdentityRepository = require('../repositories/deviceIdentity.repository');

function normalizeIdentifierValue(type, rawValue) {
    const value = String(rawValue || '').trim();
    if (!value) return null;

    if (type === 'IMEI') {
        const digits = value.replace(/\D+/g, '');
        // Common IMEI length is 15, but accept 14-16 to avoid blocking edge cases.
        if (digits.length < 14 || digits.length > 16) {
            throw new ApiError(422, 'Invalid IMEI format');
        }
        return digits;
    }

    if (type === 'SERIAL') {
        const compact = value.replace(/\s+/g, '').toUpperCase();
        if (compact.length < 4) throw new ApiError(422, 'Invalid serial number format');
        return compact;
    }

    throw new ApiError(500, 'Unsupported identifier type');
}

function buildIdentifiers({ imei, serialNumber, strict = true }) {
    const identifiers = [];

    if (imei) {
        try {
            const normalizedValue = normalizeIdentifierValue('IMEI', imei);
            if (normalizedValue) {
                identifiers.push({ type: 'IMEI', rawValue: String(imei).trim(), normalizedValue });
            }
        } catch (err) {
            if (strict) throw err;
        }
    }

    if (serialNumber) {
        try {
            const normalizedValue = normalizeIdentifierValue('SERIAL', serialNumber);
            if (normalizedValue) {
                identifiers.push({ type: 'SERIAL', rawValue: String(serialNumber).trim(), normalizedValue });
            }
        } catch (err) {
            if (strict) throw err;
        }
    }

    return identifiers;
}

async function registerDeviceIdentity({ userId, deviceTypeId, imei, serialNumber }) {
    if (!userId) throw new ApiError(401, 'Unauthorized');
    if (!deviceTypeId) throw new ApiError(422, 'deviceTypeId is required');

    const identifiers = buildIdentifiers({ imei, serialNumber, strict: true });
    if (identifiers.length === 0) throw new ApiError(422, 'Provide imei or serialNumber');

    // NOTE: we currently only record identities; ownership proof / anti-fraud can be layered later.
    const identity = await deviceIdentityRepository.upsertIdentityWithIdentifiers({
        deviceTypeId,
        identifiers
    });

    return {
        identity,
        identifiers: identifiers.map((i) => ({ type: i.type, value: i.rawValue }))
    };
}

async function reportDeviceStolen({ userId, deviceTypeId, imei, serialNumber, description }) {
    if (!userId) throw new ApiError(401, 'Unauthorized');

    const { identity, identifiers } = await registerDeviceIdentity({
        userId,
        deviceTypeId,
        imei,
        serialNumber
    });

    const updated = await deviceIdentityRepository.markIdentityStolen({
        identityId: identity.id,
        reportedByUserId: userId,
        description
    });

    return {
        identity: updated,
        identifiers
    };
}

module.exports = {
    registerDeviceIdentity,
    reportDeviceStolen,
    buildIdentifiers,
    normalizeIdentifierValue
};
