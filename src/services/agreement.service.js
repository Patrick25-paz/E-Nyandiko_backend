const { ApiError } = require('../utils/errors');
const agreementRepository = require('../repositories/agreement.repository');
const authRepository = require('../repositories/auth.repository');
const deviceRepository = require('../repositories/device.repository');
const { hashPassword } = require('../utils/hash');
const { uploadBuffer } = require('./imageUpload.service');
const env = require('../config/env');
const jwt = require('jsonwebtoken');
const { sendAgreementApprovalEmail } = require('../utils/email');

function createAgreementApprovalToken({ agreementId, buyerId }) {
    return jwt.sign(
        {
            typ: 'agreement_approval',
            agreementId,
            buyerId
        },
        env.JWT_SECRET,
        {
            subject: buyerId,
            expiresIn: '30d'
        }
    );
}

function verifyAgreementApprovalToken(token) {
    let payload;
    try {
        payload = jwt.verify(token, env.JWT_SECRET);
    } catch {
        throw new ApiError(401, 'Invalid or expired token');
    }

    if (payload?.typ !== 'agreement_approval') throw new ApiError(401, 'Invalid token type');
    if (!payload?.agreementId || !payload?.buyerId) throw new ApiError(401, 'Invalid token payload');

    return payload;
}

function generateClientCode() {
    // Short, shareable code for walk-in clients (not a secret)
    return `EN-${Math.random().toString(36).slice(2, 6).toUpperCase()}${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
}

function generatePin() {
    // Simple PIN for walk-in client login (secret)
    return String(Math.floor(100000 + Math.random() * 900000));
}

async function createWalkInBuyer({ buyerEmail, buyerNationalId, buyerFullName }) {
    // We must always create a unique email because Prisma requires it.
    for (let attempt = 0; attempt < 10; attempt++) {
        const clientCode = generateClientCode();
        const pin = generatePin();

        const email = buyerEmail || `${clientCode.toLowerCase()}@client.enyandiko.local`;

        const existingByEmail = await authRepository.findUserByEmail(email);
        if (existingByEmail) {
            if (buyerEmail) throw new ApiError(409, 'Email already registered');
            continue;
        }

        if (buyerNationalId) {
            const existingByNid = await authRepository.findUserByNationalId(buyerNationalId);
            if (existingByNid) throw new ApiError(409, 'National ID already registered');
        }

        const existingByCode = await authRepository.findUserByClientCode(clientCode);
        if (existingByCode) continue;

        const passwordHash = await hashPassword(pin);

        const user = await authRepository.createUser({
            email,
            fullName: buyerFullName,
            phone: null,
            passwordHash,
            clientCode,
            nationalId: buyerNationalId || null
        });

        await authRepository.assignRole(user.id, 'BUYER');
        await authRepository.createBuyerProfile(user.id);

        const authUser = await authRepository.getAuthUserById(user.id);

        return {
            buyerUser: authUser,
            clientAuth: {
                clientCode,
                pin,
                identifiers: {
                    clientCode,
                    email: buyerEmail || null,
                    nationalId: buyerNationalId || null
                }
            }
        };
    }

    throw new ApiError(500, 'Failed to generate client credentials');
}

async function createAgreement({
    sellerId,
    deviceId,
    buyerEmail,
    buyerNationalId,
    buyerFullName,
    buyerLocation,
    price,
    currency,
    terms,
    sendEmail,
    files
}) {
    if (!sellerId) throw new ApiError(403, 'Seller profile required');

    if (!buyerEmail) {
        throw new ApiError(422, 'Buyer email is required');
    }

    // buyerEmail is required.

    const device = await deviceRepository.findDeviceById(deviceId);
    if (!device) throw new ApiError(404, 'Device not found');
    if (device.sellerId !== sellerId) throw new ApiError(403, 'You can only create agreements for your own devices');

    let buyerUser = null;
    let clientAuth = null;

    // Optimization: avoid sequential lookups when both identifiers are provided.
    const [buyerByEmail, buyerByNid] = await Promise.all([
        buyerEmail ? authRepository.findUserByEmail(buyerEmail) : Promise.resolve(null),
        buyerNationalId ? authRepository.findUserByNationalId(buyerNationalId) : Promise.resolve(null)
    ]);

    buyerUser = buyerByEmail || buyerByNid;

    if (!buyerUser) {
        const createdBuyer = await createWalkInBuyer({ buyerEmail, buyerNationalId, buyerFullName });
        buyerUser = createdBuyer.buyerUser;
        clientAuth = createdBuyer.clientAuth;
    }

    const buyerRoleNames = Array.isArray(buyerUser.roles)
        ? (typeof buyerUser.roles[0] === 'string'
            ? buyerUser.roles
            : buyerUser.roles.map((ur) => ur.role.name))
        : [];

    if (!buyerRoleNames.includes('BUYER')) {
        await authRepository.assignRole(buyerUser.id, 'BUYER');
    }

    const buyerId = buyerUser.buyerId || buyerUser.buyer?.id || null;
    const buyerProfile = buyerId ? { id: buyerId } : await authRepository.createBuyerProfile(buyerUser.id);

    // Store the provided client profile details inside the terms as well (for reporting), but don't force a specific format.
    // If terms is JSON, the frontend can already include these; this is just a minimal append for safety.
    if (buyerFullName || buyerLocation || buyerNationalId) {
        try {
            const parsed = JSON.parse(terms);
            if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
                parsed.client = parsed.client || {};
                parsed.client.fullName = parsed.client.fullName || buyerFullName;
                parsed.client.location = parsed.client.location || buyerLocation;
                parsed.client.nationalId = parsed.client.nationalId || buyerNationalId;
                terms = JSON.stringify(parsed, null, 2);
            }
        } catch {
            // non-JSON terms: leave as-is
        }
    }

    const agreement = await agreementRepository.createAgreement({
        deviceId,
        sellerId,
        buyerId: buyerProfile.id,
        price: String(price),
        currency,
        terms,
        status: 'PENDING',
        isImmutable: false
    });

    const exchangeImageFiles = Array.isArray(files) ? files : (files?.images || []);
    const buyerImageFiles = Array.isArray(files) ? [] : (files?.buyerImage || []);

    if (exchangeImageFiles && exchangeImageFiles.length > 0) {
        const folder = `${env.CLOUDINARY_FOLDER}/agreements/${agreement.id}/client_device`;

        const uploaded = [];
        for (const file of exchangeImageFiles) {
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

        try {
            const termsObj = JSON.parse(agreement.terms);
            if (termsObj.exchange && termsObj.exchange.clientPhone) {
                termsObj.exchange.clientPhone.images = uploaded;
                agreement.terms = JSON.stringify(termsObj, null, 2);
                await agreementRepository.updateAgreementTerms(agreement.id, agreement.terms);
            }
        } catch (e) {
            console.error('Failed to attach images to agreement terms', e);
        }
    }

    if (buyerImageFiles && buyerImageFiles.length > 0) {
        const file = buyerImageFiles[0];
        const folder = `${env.CLOUDINARY_FOLDER}/agreements/${agreement.id}/client_photo`;

        const result = await uploadBuffer({
            buffer: file.buffer,
            folder,
            filename: file.originalname.replace(/\.[^.]+$/, '')
        });

        const uploaded = {
            url: result.secure_url,
            publicId: result.public_id,
            bytes: result.bytes,
            width: result.width,
            height: result.height,
            format: result.format
        };

        try {
            const termsObj = JSON.parse(agreement.terms);
            if (termsObj && typeof termsObj === 'object' && !Array.isArray(termsObj)) {
                termsObj.client = termsObj.client || {};
                termsObj.client.photo = uploaded;
                agreement.terms = JSON.stringify(termsObj, null, 2);
                await agreementRepository.updateAgreementTerms(agreement.id, agreement.terms);
            }
        } catch (e) {
            console.error('Failed to attach buyer image to agreement terms', e);
        }
    }

    // Optional: email the buyer a public approval link (no login required)
    if (sendEmail && buyerEmail) {
        const approvalToken = createAgreementApprovalToken({ agreementId: agreement.id, buyerId: buyerProfile.id });
        const approvalUrl = `${env.FRONTEND_URL}/agreements/${agreement.id}/approve?token=${encodeURIComponent(approvalToken)}`;

        await sendAgreementApprovalEmail({
            to: buyerEmail,
            agreementId: agreement.id,
            sellerName: null,
            approvalUrl
        });
    }

    return { agreement, clientAuth };
}

async function getPublicAgreementByApprovalToken({ agreementId, token }) {
    const payload = verifyAgreementApprovalToken(token);
    if (payload.agreementId !== agreementId) throw new ApiError(401, 'Token agreement mismatch');

    const agreement = await agreementRepository.findAgreementById(agreementId);
    if (!agreement) throw new ApiError(404, 'Agreement not found');
    if (payload.buyerId !== agreement.buyerId) throw new ApiError(401, 'Token buyer mismatch');

    const deviceDetails = await deviceRepository.getDeviceForAgreement(agreement.deviceId);

    return {
        ...agreement,
        price: String(agreement.price),
        deviceDetails
    };
}

async function confirmAgreementByApprovalToken({ agreementId, token }) {
    const payload = verifyAgreementApprovalToken(token);
    if (payload.agreementId !== agreementId) throw new ApiError(401, 'Token agreement mismatch');

    return confirmAgreement({
        buyerId: payload.buyerId,
        agreementId
    });
}

async function confirmAgreement({ buyerId, agreementId }) {
    if (!buyerId) throw new ApiError(403, 'Buyer profile required');

    const agreement = await agreementRepository.findAgreementById(agreementId);
    if (!agreement) throw new ApiError(404, 'Agreement not found');

    if (agreement.buyerId !== buyerId) throw new ApiError(403, 'You can only confirm your own agreements');
    if (agreement.isImmutable || agreement.status === 'ACCEPTED') throw new ApiError(409, 'Agreement is already accepted/immutable');

    // Snapshot device at acceptance
    const device = await deviceRepository.getDeviceForAgreement(agreement.deviceId);
    if (!device) throw new ApiError(404, 'Device not found');

    const deviceSnapshot = {
        id: device.id,
        deviceType: { id: device.deviceTypeId, name: device.deviceType.name },
        title: device.title,
        fields: device.fieldValues.map((fv) => ({
            key: fv.deviceField.key,
            label: fv.deviceField.label,
            dataType: fv.deviceField.dataType,
            value: fv.value
        })),
        images: device.images.map((img) => ({ url: img.url, publicId: img.publicId }))
    };

    const accepted = await agreementRepository.setAgreementAccepted({
        agreementId,
        deviceSnapshot
    });

    // Only mark the device as SOLD (out of stock) for transaction types that leave the seller.
    // For BUY agreements, the seller is buying the device into stock, so keep it ACTIVE.
    let transactionType = null;
    try {
        const parsed = JSON.parse(accepted.terms);
        transactionType = parsed?.transactionType || null;
    } catch {
        transactionType = null;
    }

    if (transactionType !== 'BUY') {
        await agreementRepository.setDeviceSold(device.id);
    }

    return accepted;
}

async function getAgreementForDocument({ agreementId }) {
    const agreement = await agreementRepository.findAgreementById(agreementId);
    if (!agreement) throw new ApiError(404, 'Agreement not found');

    const deviceDetails = await deviceRepository.getDeviceForAgreement(agreement.deviceId);

    // Normalize some fields for display
    return {
        ...agreement,
        price: String(agreement.price),
        deviceDetails
    };
}

async function getAgreementById({ agreementId, userId, roles }) {
    const agreement = await agreementRepository.findAgreementById(agreementId);
    if (!agreement) throw new ApiError(404, 'Agreement not found');

    const isAdmin = (roles || []).includes('ADMIN');
    const isSeller = agreement.seller?.user?.id && agreement.seller.user.id === userId;
    const isBuyer = agreement.buyer?.user?.id && agreement.buyer.user.id === userId;
    if (!isAdmin && !isSeller && !isBuyer) throw new ApiError(403, 'Forbidden');

    const deviceDetails = await deviceRepository.getDeviceForAgreement(agreement.deviceId);

    return {
        ...agreement,
        price: String(agreement.price),
        deviceDetails
    };
}

async function deleteAgreement({ sellerId, agreementId }) {
    if (!sellerId) throw new ApiError(403, 'Seller profile required');

    const agreement = await agreementRepository.findAgreementById(agreementId);
    if (!agreement) throw new ApiError(404, 'Agreement not found');

    if (agreement.sellerId !== sellerId) throw new ApiError(403, 'You can only cancel your own agreements');
    if (agreement.status !== 'PENDING') throw new ApiError(409, 'Only pending agreements can be canceled');

    await agreementRepository.deleteAgreement(agreementId);
    return { success: true };
}



module.exports = {
    createAgreement,
    confirmAgreement,
    listSoldAgreements,
    listBoughtAgreements,
    getAgreementForDocument,
    getAgreementById,
    deleteAgreement,
    getPublicAgreementByApprovalToken,
    confirmAgreementByApprovalToken
};

async function listSoldAgreements({ sellerId, limit, skip }) {
    if (!sellerId) throw new ApiError(403, 'Seller profile required');
    return agreementRepository.listAgreementsAsSeller(sellerId, { limit, skip });
}

async function listBoughtAgreements({ buyerId, limit, skip }) {
    if (!buyerId) throw new ApiError(403, 'Buyer profile required');
    return agreementRepository.listAgreementsAsBuyer(buyerId, { limit, skip });
}

