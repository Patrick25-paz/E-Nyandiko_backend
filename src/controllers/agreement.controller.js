const agreementService = require('../services/agreement.service');
const { created, ok } = require('../utils/response');
const { ApiError } = require('../utils/errors');
const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');
const jwt = require('jsonwebtoken');
const env = require('../config/env');

function safeJsonParse(text) {
    if (!text || typeof text !== 'string') return null;
    try {
        return JSON.parse(text);
    } catch {
        return null;
    }
}

function renderKeyValue(doc, label, value) {
    doc
        .font('Helvetica-Bold')
        .text(`${label}: `, { continued: true })
        .font('Helvetica')
        .text(value || '-');
}

async function createAgreement(req, res, next) {
    try {
        const result = await agreementService.createAgreement({
            sellerId: req.user.sellerId,
            deviceId: req.body.deviceId,
            buyerEmail: req.body.buyerEmail,
            buyerNationalId: req.body.buyerNationalId,
            buyerFullName: req.body.buyerFullName,
            buyerLocation: req.body.buyerLocation,
            price: req.body.price,
            currency: req.body.currency,
            terms: req.body.terms,
            sendEmail: req.body.sendEmail,
            files: req.files
        });

        return created(res, {
            message: 'Agreement created',
            data: result.agreement,
            meta: result.clientAuth ? { clientAuth: result.clientAuth } : null
        });
    } catch (err) {
        return next(err);
    }
}

async function confirmAgreement(req, res, next) {
    try {
        const agreement = await agreementService.confirmAgreement({
            buyerId: req.user.buyerId,
            agreementId: req.params.id
        });

        return ok(res, { message: 'Agreement accepted', data: agreement });
    } catch (err) {
        return next(err);
    }
}

async function listSold(req, res, next) {
    try {
        const agreements = await agreementService.listSoldAgreements({
            sellerId: req.user.sellerId,
            limit: req.query.limit,
            skip: req.query.skip
        });

        return ok(res, { message: 'Sold agreements', data: agreements });
    } catch (err) {
        return next(err);
    }
}

async function listBought(req, res, next) {
    try {
        const agreements = await agreementService.listBoughtAgreements({
            buyerId: req.user.buyerId,
            limit: req.query.limit,
            skip: req.query.skip
        });

        return ok(res, { message: 'Bought agreements', data: agreements });
    } catch (err) {
        return next(err);
    }
}


async function document(req, res, next) {
    try {
        const agreement = await agreementService.getAgreementForDocument({
            agreementId: req.params.id
        });

        // Access control: allow either Authorization header (req.user is set by auth middleware)
        // OR a short-lived token passed as ?token=... (for iframe/new-tab rendering).
        let userId = req.user?.id || null;
        let roles = req.user?.roles || [];

        if (!userId) {
            // 1) Try Bearer auth token
            const header = req.headers.authorization;
            if (header && String(header).startsWith('Bearer ')) {
                const bearer = String(header).slice('Bearer '.length).trim();
                let payload;
                try {
                    payload = jwt.verify(bearer, env.JWT_SECRET);
                } catch {
                    throw new ApiError(401, 'Invalid or expired token');
                }

                userId = payload.sub;
                roles = payload.roles || [];
            } else {
                // 2) Try short-lived document token from query
                const token = req.query?.token;
                if (!token) throw new ApiError(401, 'Missing Authorization');

                let payload;
                try {
                    payload = jwt.verify(token, env.JWT_SECRET);
                } catch {
                    throw new ApiError(401, 'Invalid or expired token');
                }

                if (payload?.typ === 'agreement_document') {
                    if (payload?.agreementId !== agreement.id) throw new ApiError(401, 'Token agreement mismatch');
                    userId = payload.sub;
                    roles = payload.roles || [];
                } else if (payload?.typ === 'agreement_approval') {
                    if (payload?.agreementId !== agreement.id) throw new ApiError(401, 'Token agreement mismatch');
                    if (payload?.buyerId !== agreement.buyer?.id) throw new ApiError(401, 'Token buyer mismatch');

                    // Treat this as buyer access for the purpose of access checks.
                    userId = agreement.buyer?.user?.id;
                    roles = ['BUYER'];
                } else {
                    throw new ApiError(401, 'Invalid token type');
                }
            }
        }

        const isAdmin = roles.includes('ADMIN');
        const isSeller = agreement.seller?.user?.id && agreement.seller.user.id === userId;
        const isBuyer = agreement.buyer?.user?.id && agreement.buyer.user.id === userId;
        if (!isAdmin && !isSeller && !isBuyer) throw new ApiError(403, 'Forbidden');

        // Buffer the full PDF in memory before sending.
        // This ensures a complete, valid PDF is sent — streaming directly to res
        // can produce a corrupted file if any error occurs mid-generation.
        const pdfBuffer = await new Promise((resolve, reject) => {
            const chunks = [];
            const doc = new PDFDocument({ size: 'A4', margin: 50 });

            doc.on('data', (chunk) => chunks.push(chunk));
            doc.on('end', () => resolve(Buffer.concat(chunks)));
            doc.on('error', reject);

            // Logo (read from frontend assets in this workspace)
            const logoPath = path.resolve(__dirname, '../../../frontend/src/images/E-Nyandiko.png');
            if (fs.existsSync(logoPath)) {
                try {
                    doc.image(logoPath, 50, 45, { width: 60 });
                } catch {
                    // ignore logo errors
                }
            }

            doc
                .font('Helvetica-Bold')
                .fontSize(18)
                .text('E-Nyandiko Agreement Document', 0, 50, { align: 'center' });

            doc
                .font('Helvetica')
                .fontSize(10)
                .text(`Agreement ID: ${agreement.id}`, { align: 'center' })
                .text(`Status: ${agreement.status}`, { align: 'center' })
                .moveDown(1.5);

            doc.fontSize(12).font('Helvetica-Bold').text('Parties');
            doc.moveDown(0.5);

            const sellerUser = agreement.seller?.user;
            const buyerUser = agreement.buyer?.user;

            doc.font('Helvetica-Bold').text('Seller');
            doc.font('Helvetica');
            renderKeyValue(doc, 'Full name', sellerUser?.fullName);
            renderKeyValue(doc, 'Email', sellerUser?.email);
            doc.moveDown(0.5);

            doc.font('Helvetica-Bold').text('Buyer');
            doc.font('Helvetica');
            renderKeyValue(doc, 'Full name', buyerUser?.fullName);
            renderKeyValue(doc, 'Email', buyerUser?.email);
            renderKeyValue(doc, 'National ID', buyerUser?.nationalId);
            renderKeyValue(doc, 'Client code', buyerUser?.clientCode);
            doc.moveDown(1);

            doc.fontSize(12).font('Helvetica-Bold').text('Device');
            doc.moveDown(0.5);

            const device = agreement.deviceDetails || agreement.device;
            renderKeyValue(doc, 'Type', device?.deviceType?.name);
            renderKeyValue(doc, 'Title', device?.title);

            if (device?.fieldValues && Array.isArray(device.fieldValues) && device.fieldValues.length > 0) {
                doc.moveDown(0.5);
                doc.font('Helvetica-Bold').text('Device details');
                doc.font('Helvetica');
                for (const fv of device.fieldValues) {
                    const key = fv.deviceField?.label || fv.deviceField?.key || 'Field';
                    const value = typeof fv.value === 'object' ? JSON.stringify(fv.value) : String(fv.value);
                    doc.text(`- ${key}: ${value}`);
                }
            }

            doc.moveDown(1);
            doc.fontSize(12).font('Helvetica-Bold').text('Agreement');
            doc.moveDown(0.5);
            renderKeyValue(doc, 'Price', `${agreement.price} ${agreement.currency}`);
            renderKeyValue(doc, 'Created', agreement.createdAt ? new Date(agreement.createdAt).toLocaleString() : '-');
            renderKeyValue(doc, 'Confirmed', agreement.acceptedAt ? new Date(agreement.acceptedAt).toLocaleString() : '-');
            doc.moveDown(0.75);

            const termsObj = safeJsonParse(agreement.terms);
            if (termsObj) {
                doc.font('Helvetica-Bold').text('Terms & Conditions');
                doc.font('Helvetica');

                const tx = termsObj.transactionType || '-';
                doc.text(`Transaction type: ${tx}`);

                if (termsObj?.client && typeof termsObj.client === 'object') {
                    const c = termsObj.client;
                    if (c.location) doc.text(`Client location: ${c.location}`);
                }

                if (termsObj?.warranty && typeof termsObj.warranty === 'object') {
                    const w = termsObj.warranty;
                    const months = w.months !== null && w.months !== undefined ? String(w.months) : '-';
                    doc.text(`Warranty months: ${months}`);
                    if (w.details) doc.text(`Warranty details: ${w.details}`);
                }

                if (termsObj?.conditions) {
                    doc.moveDown(0.5);
                    doc.font('Helvetica-Bold').text('Conditions');
                    doc.font('Helvetica').text(String(termsObj.conditions));
                }

                if (tx === 'BUY' && termsObj?.topUpPlan) {
                    doc.moveDown(0.5);
                    doc.font('Helvetica-Bold').text('Top-up plan');
                    doc.font('Helvetica').text(String(termsObj.topUpPlan));
                }
            } else {
                doc.font('Helvetica-Bold').text('Terms');
                doc.font('Helvetica').text(String(agreement.terms || '-'));
            }

            doc.moveDown(2);
            doc
                .fontSize(10)
                .font('Helvetica')
                .text('This document was generated by E-Nyandiko.', { align: 'center' });

            doc.end();
        });

        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `inline; filename="agreement-${agreement.id}.pdf"`);
        res.setHeader('Content-Length', pdfBuffer.length);
        res.end(pdfBuffer);
    } catch (err) {
        return next(err);
    }
}

async function publicAgreement(req, res, next) {
    try {
        const agreement = await agreementService.getPublicAgreementByApprovalToken({
            agreementId: req.params.id,
            token: req.query.token
        });

        return ok(res, { message: 'Agreement', data: agreement });
    } catch (err) {
        return next(err);
    }
}

async function publicConfirmAgreement(req, res, next) {
    try {
        const agreement = await agreementService.confirmAgreementByApprovalToken({
            agreementId: req.params.id,
            token: req.body.token
        });

        return ok(res, { message: 'Agreement accepted', data: agreement });
    } catch (err) {
        return next(err);
    }
}

async function documentToken(req, res, next) {
    try {
        const agreement = await agreementService.getAgreementForDocument({
            agreementId: req.params.id
        });

        const userId = req.user?.id;
        const roles = req.user?.roles || [];
        if (!userId) throw new ApiError(401, 'Missing Authorization');

        const isAdmin = roles.includes('ADMIN');
        const isSeller = agreement.seller?.user?.id && agreement.seller.user.id === userId;
        const isBuyer = agreement.buyer?.user?.id && agreement.buyer.user.id === userId;
        if (!isAdmin && !isSeller && !isBuyer) throw new ApiError(403, 'Forbidden');

        // Short-lived token: safe to use in query string for viewing the PDF.
        const token = jwt.sign(
            {
                typ: 'agreement_document',
                agreementId: agreement.id,
                roles
            },
            env.JWT_SECRET,
            {
                subject: userId,
                expiresIn: '5m'
            }
        );

        return ok(res, { message: 'Document token', data: { token } });
    } catch (err) {
        return next(err);
    }
}

async function getAgreement(req, res, next) {
    try {
        const agreement = await agreementService.getAgreementById({
            agreementId: req.params.id,
            userId: req.user?.id,
            roles: req.user?.roles || []
        });
        return ok(res, { message: 'Agreement', data: agreement });
    } catch (err) {
        return next(err);
    }
}

async function deleteAgreement(req, res, next) {
    try {
        const { id } = req.params;
        const sellerId = req.user.sellerId;
        const result = await agreementService.deleteAgreement({ sellerId, agreementId: id });
        res.status(200).json({
            status: 'success',
            data: result
        });
    } catch (err) {
        next(err);
    }
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
    deleteAgreement
};
