const agreementService = require('../services/agreement.service');
const { created, ok } = require('../utils/response');
const { ApiError } = require('../utils/errors');
const jwt = require('jsonwebtoken');
const env = require('../config/env');
const { renderAgreementPdf } = require('./agreement.template');

// ─────────────────────────────────────────────
// ROUTE HANDLERS
// ─────────────────────────────────────────────

async function createAgreement(req, res, next) {
    try {
        const buyerImages = Array.isArray(req.files?.buyerImage) ? req.files.buyerImage : [];
        if (buyerImages.length === 0) throw new ApiError(422, 'Client image is required');

        const result = await agreementService.createAgreement({
            userId: req.user.id,
            sellerId: req.user.sellerId,
            deviceId: req.body.deviceId,
            sharedExchangeDeviceId: req.body.sharedExchangeDeviceId,
            buyerEmail: req.body.buyerEmail,
            buyerNationalId: req.body.buyerNationalId,
            buyerFullName: req.body.buyerFullName,
            buyerLocation: req.body.buyerLocation,
            price: req.body.price,
            currency: req.body.currency,
            terms: req.body.terms,
            sendEmail: req.body.sendEmail,
            files: req.files,
        });

        return created(res, {
            message: 'Agreement created',
            data: result.agreement,
            meta: result.clientAuth ? { clientAuth: result.clientAuth } : null,
        });
    } catch (err) { return next(err); }
}

async function confirmAgreement(req, res, next) {
    try {
        const agreement = await agreementService.confirmAgreement({
            buyerId: req.user.buyerId,
            agreementId: req.params.id,
        });
        return ok(res, { message: 'Agreement accepted', data: agreement });
    } catch (err) { return next(err); }
}

async function listSold(req, res, next) {
    try {
        const agreements = await agreementService.listSoldAgreements({
            userId: req.user.id,
            sellerId: req.user.sellerId,
            limit: req.query.limit,
            skip: req.query.skip,
        });
        return ok(res, { message: 'Sold agreements', data: agreements });
    } catch (err) { return next(err); }
}

async function listBought(req, res, next) {
    try {
        const agreements = await agreementService.listBoughtAgreements({
            buyerId: req.user.buyerId,
            limit: req.query.limit,
            skip: req.query.skip,
        });
        return ok(res, { message: 'Bought agreements', data: agreements });
    } catch (err) { return next(err); }
}

// ─────────────────────────────────────────────
// MAIN PDF GENERATOR
// ─────────────────────────────────────────────

async function document(req, res, next) {
    try {
        const agreement = await agreementService.getAgreementForDocument({
            agreementId: req.params.id,
        });

        // ── Auth ──────────────────────────────────────────────────────────────
        let userId = req.user?.id || null;
        let userType = req.user?.type || null;

        if (!userId) {
            const header = req.headers.authorization;
            if (header && String(header).startsWith('Bearer ')) {
                const bearer = String(header).slice('Bearer '.length).trim();
                let payload;
                try { payload = jwt.verify(bearer, env.JWT_SECRET); }
                catch { throw new ApiError(401, 'Invalid or expired token'); }
                userId = payload.sub;
                userType = payload.type || null;
            } else {
                const token = req.query?.token;
                if (!token) throw new ApiError(401, 'Missing Authorization');
                let payload;
                try { payload = jwt.verify(token, env.JWT_SECRET); }
                catch { throw new ApiError(401, 'Invalid or expired token'); }

                if (payload?.typ === 'agreement_document') {
                    if (payload?.agreementId !== agreement.id) throw new ApiError(401, 'Token agreement mismatch');
                    userId = payload.sub;
                    userType = payload.type || null;
                } else if (payload?.typ === 'agreement_approval') {
                    if (payload?.agreementId !== agreement.id) throw new ApiError(401, 'Token agreement mismatch');
                    if (payload?.buyerId !== agreement.buyer?.id) throw new ApiError(401, 'Token buyer mismatch');
                    userId = agreement.buyer?.user?.id;
                    userType = 'INDIVIDUAL';
                } else {
                    throw new ApiError(401, 'Invalid token type');
                }
            }
        }

        const isAdmin  = userType === 'ADMIN';
        const isSeller = agreement.seller?.user?.id && agreement.seller.user.id === userId;
        const isBuyer  = agreement.buyer?.user?.id  && agreement.buyer.user.id  === userId;
        if (!isAdmin && !isSeller && !isBuyer) throw new ApiError(403, 'Forbidden');

        const pdfBuffer = await renderAgreementPdf(agreement);
        const buffer = Buffer.isBuffer(pdfBuffer) ? pdfBuffer : Buffer.from(pdfBuffer);

        // ── Send response ────────────────────────────────────────────────────
        res.setHeader('Content-Type', 'application/pdf');
        const dl = String(req.query?.download || '').toLowerCase();
        const isDownload = dl === '1' || dl === 'true' || dl === 'yes';
        res.setHeader('Content-Disposition', `${isDownload ? 'attachment' : 'inline'}; filename="agreement-${agreement.id}.pdf"`);
        return res.send(buffer);

    } catch (err) { return next(err); }
}

// ─────────────────────────────────────────────
// REMAINING HANDLERS (unchanged logic)
// ─────────────────────────────────────────────

async function publicAgreement(req, res, next) {
    try {
        const agreement = await agreementService.getPublicAgreementByApprovalToken({
            agreementId: req.params.id,
            token: req.query.token,
        });
        return ok(res, { message: 'Agreement', data: agreement });
    } catch (err) { return next(err); }
}

async function publicConfirmAgreement(req, res, next) {
    try {
        const agreement = await agreementService.confirmAgreementByApprovalToken({
            agreementId: req.params.id,
            token: req.body.token,
        });
        return ok(res, { message: 'Agreement accepted', data: agreement });
    } catch (err) { return next(err); }
}

async function documentToken(req, res, next) {
    try {
        const agreement = await agreementService.getAgreementForDocument({
            agreementId: req.params.id,
        });
        const userId = req.user?.id;
        const userType = req.user?.type || null;
        if (!userId) throw new ApiError(401, 'Missing Authorization');

        const isAdmin  = userType === 'ADMIN';
        const isSeller = agreement.seller?.user?.id && agreement.seller.user.id === userId;
        const isBuyer  = agreement.buyer?.user?.id  && agreement.buyer.user.id  === userId;
        if (!isAdmin && !isSeller && !isBuyer) throw new ApiError(403, 'Forbidden');

        const token = jwt.sign(
            { typ: 'agreement_document', agreementId: agreement.id, type: userType },
            env.JWT_SECRET,
            { subject: userId, expiresIn: '5m' }
        );
        return ok(res, { message: 'Document token', data: { token } });
    } catch (err) { return next(err); }
}

async function getAgreement(req, res, next) {
    try {
        const agreement = await agreementService.getAgreementById({
            agreementId: req.params.id,
            userId: req.user?.id,
            userType: req.user?.type || null,
        });
        return ok(res, { message: 'Agreement', data: agreement });
    } catch (err) { return next(err); }
}

async function deleteAgreement(req, res, next) {
    try {
        const result = await agreementService.deleteAgreement({
            userId: req.user.id,
            sellerId: req.user.sellerId,
            agreementId: req.params.id,
        });
        res.status(200).json({ status: 'success', data: result });
    } catch (err) { next(err); }
}

module.exports = {
    createAgreement,
    confirmAgreement,
    listSold,
    listBought,
    publicAgreement,
    publicConfirmAgreement,
    document,
    documentToken,
    getAgreement,
    deleteAgreement,
};