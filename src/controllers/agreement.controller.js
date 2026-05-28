const agreementService = require('../services/agreement.service');
const { created, ok } = require('../utils/response');
const { ApiError } = require('../utils/errors');
const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');
const jwt = require('jsonwebtoken');
const env = require('../config/env');

const PDF_STYLE = {
    colors: {
        text: '#1a1a1a',
        muted: '#666666',
        border: '#d8d5cc',
        surface: '#fafaf8',
        surfaceAlt: '#f5f3ee',
        navy: '#0f2444',
        gold: '#c9a227',
        goldSoft: '#f4ead0',
        successSoft: '#eaf3de',
        success: '#3b6d11'
    },
    sizes: {
        h1: 22,
        h2: 12,
        body: 10,
        small: 9
    }
};

function ensureSpace(doc, neededHeight) {
    const bottomPadding = 60;
    const y = doc.y || 0;
    const maxY = doc.page.height - bottomPadding;
    if (y + neededHeight > maxY) {
        doc.addPage();
        doc.y = 70;
    }
}

function drawDivider(doc) {
    const x1 = doc.page.margins.left;
    const x2 = doc.page.width - doc.page.margins.right;
    doc
        .moveTo(x1, doc.y)
        .lineTo(x2, doc.y)
        .lineWidth(1)
        .strokeColor(PDF_STYLE.colors.border)
        .stroke();
    doc.strokeColor('black');
}

function drawPill(doc, x, y, text, { bg, fg } = {}) {
    const prevX = doc.x;
    const prevY = doc.y;

    const paddingX = 8;
    const paddingY = 4;
    const radius = 10;

    doc.font('Helvetica-Bold').fontSize(PDF_STYLE.sizes.small);
    const w = doc.widthOfString(text) + paddingX * 2;
    const h = doc.currentLineHeight() + paddingY * 2 - 2;

    doc
        .roundedRect(x, y, w, h, radius)
        .fillColor(bg || PDF_STYLE.colors.brandSoft)
        .fill();

    doc
        .fillColor(fg || PDF_STYLE.colors.brand)
        .text(text, x + paddingX, y + paddingY - 1, { lineBreak: false });

    doc.fillColor(PDF_STYLE.colors.text);
    // Restore cursor so subsequent text doesn't inherit a tiny wrapping width.
    doc.x = prevX;
    doc.y = prevY;
    return { w, h };
}

function drawWatermark(doc) {
    doc.save();
    doc.fillOpacity(0.04);
    doc.font('Times-Bold').fontSize(72);
    doc.rotate(-30, { origin: [doc.page.width / 2, doc.page.height / 2] });
    doc.text('E-NYANDIKO', doc.page.width / 2 - 220, doc.page.height / 2 - 50, {
        width: 440,
        align: 'center'
    });
    doc.fillOpacity(1);
    doc.restore();
}

function measurePill(doc, text) {
    const paddingX = 8;
    const paddingY = 4;
    doc.font('Helvetica-Bold').fontSize(PDF_STYLE.sizes.small);
    const w = doc.widthOfString(text) + paddingX * 2;
    const h = doc.currentLineHeight() + paddingY * 2 - 2;
    return { w, h };
}

function sectionTitle(doc, number, title) {
    ensureSpace(doc, 34);
    const startY = doc.y + 2;
    const badgeSize = 22;
    const x = doc.page.margins.left;
    const textX = x + badgeSize + 10;

    doc.save();
    doc.circle(x + badgeSize / 2, startY + badgeSize / 2, badgeSize / 2).fillColor(PDF_STYLE.colors.navy).fill();
    doc.fillColor(PDF_STYLE.colors.gold).font('Helvetica-Bold').fontSize(11).text(String(number), x, startY + 5, {
        width: badgeSize,
        align: 'center'
    });
    doc.restore();

    doc.font('Helvetica-Bold').fontSize(11).fillColor(PDF_STYLE.colors.navy).text(String(title).toUpperCase(), textX, startY + 3, {
        width: doc.page.width - doc.page.margins.left - doc.page.margins.right - badgeSize - 10,
        characterSpacing: 0.9
    });

    doc.moveDown(0.2);
    drawDivider(doc);
    doc.moveDown(0.45);
    doc.fillColor(PDF_STYLE.colors.text);
}

function renderKeyValue(doc, label, value) {
    // Keep existing signature but make it visually cleaner.
    const labelColor = PDF_STYLE.colors.muted;
    const valueColor = PDF_STYLE.colors.text;

    doc
        .font('Helvetica')
        .fontSize(PDF_STYLE.sizes.body)
        .fillColor(labelColor)
        .text(`${label}: `, { continued: true })
        .fillColor(valueColor)
        .text(value || '-');
    doc.fillColor(PDF_STYLE.colors.text);
}

function renderKeyValueTwoCol(doc, items) {
    const list = Array.isArray(items) ? items.filter(Boolean) : [];
    if (list.length === 0) return;

    const startY = doc.y;
    const xLeft = doc.page.margins.left;
    const xRight = doc.page.width / 2 + 10;
    const colWidth = doc.page.width / 2 - doc.page.margins.left - doc.page.margins.right - 10;

    let yLeft = startY;
    let yRight = startY;
    let i = 0;
    for (const it of list) {
        const x = i % 2 === 0 ? xLeft : xRight;
        const y = i % 2 === 0 ? yLeft : yRight;
        doc.x = x;
        doc.y = y;

        const label = it.label;
        const value = it.value;
        doc
            .font('Helvetica')
            .fontSize(PDF_STYLE.sizes.body)
            .fillColor(PDF_STYLE.colors.muted)
            .text(`${label}:`, x, y, { width: colWidth, continued: false });
        const afterLabelY = doc.y;
        doc
            .fillColor(PDF_STYLE.colors.text)
            .text(value || '-', x, afterLabelY, { width: colWidth });

        if (i % 2 === 0) yLeft = doc.y + 6;
        else yRight = doc.y + 6;
        i += 1;
    }

    doc.x = xLeft;
    doc.y = Math.max(yLeft, yRight);
    doc.fillColor(PDF_STYLE.colors.text);
}

function normalizeCloudinaryImageUrl(url) {
    if (!url || typeof url !== 'string') return null;
    const s = url.trim();
    if (!/^https?:\/\//i.test(s)) return null;

    // PDFKit doesn't support WebP. Cloudinary can convert to JPG via transformation.
    // Insert `f_jpg` right after `/image/upload/` when possible.
    if (s.includes('res.cloudinary.com') && s.includes('/image/upload/')) {
        // Avoid double-inserting if transformations already include f_*
        const [prefix, rest] = s.split('/image/upload/');
        if (!rest) return s;
        if (/^f_[^/]+\//.test(rest)) return s;
        return `${prefix}/image/upload/f_jpg/${rest}`;
    }

    return s;
}

async function fetchImageBuffer(url, { timeoutMs = 12_000, maxBytes = 5 * 1024 * 1024 } = {}) {
    const normalized = normalizeCloudinaryImageUrl(url) || url;
    if (!normalized || !/^https?:\/\//i.test(String(normalized))) return null;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    try {
        const res = await fetch(normalized, {
            method: 'GET',
            headers: { Accept: 'image/*' },
            signal: controller.signal
        });
        if (!res.ok) return null;

        const contentType = String(res.headers.get('content-type') || '').toLowerCase();
        if (!contentType.startsWith('image/')) return null;
        if (contentType.includes('svg')) return null;

        const ab = await res.arrayBuffer();
        const buf = Buffer.from(ab);
        if (buf.length === 0) return null;
        if (buf.length > maxBytes) return null;
        return buf;
    } catch {
        return null;
    } finally {
        clearTimeout(timeout);
    }
}

function addImageGrid(doc, title, buffers) {
    const list = Array.isArray(buffers) ? buffers.filter(Boolean) : [];
    if (list.length === 0) return;

    const marginX = 50;
    const gap = 12;
    const pageWidth = doc.page.width;
    const usableWidth = pageWidth - marginX * 2;
    const cols = 2;
    const colWidth = (usableWidth - gap) / cols;
    const colHeight = 150;

    ensureSpace(doc, 220);
    doc.moveDown(0.75);
    doc
        .font('Helvetica-Bold')
        .fontSize(PDF_STYLE.sizes.body)
        .fillColor(PDF_STYLE.colors.text)
        .text(title);
    doc.moveDown(0.35);

    let x = marginX;
    let y = doc.y;
    let col = 0;

    for (const buf of list.slice(0, 6)) {
        // New page if needed
        if (y + colHeight > doc.page.height - 70) {
            doc.addPage();
            x = marginX;
            y = 70;
            col = 0;
        }

        try {
            doc.rect(x, y, colWidth, colHeight).strokeColor(PDF_STYLE.colors.border).stroke();
            doc.image(buf, x + 4, y + 4, {
                fit: [colWidth - 8, colHeight - 8],
                align: 'center',
                valign: 'center'
            });
        } catch {
            // ignore per-image errors
        }

        col += 1;
        if (col >= cols) {
            col = 0;
            x = marginX;
            y += colHeight + gap;
        } else {
            x += colWidth + gap;
        }
    }

    doc.y = y + colHeight + 6;
    doc.strokeColor('black');
}

function safeJsonParse(text) {
    if (!text || typeof text !== 'string') return null;
    try {
        return JSON.parse(text);
    } catch {
        return null;
    }
}

// (renderKeyValue is defined above with styling)

async function createAgreement(req, res, next) {
    try {
        const buyerImages = Array.isArray(req.files?.buyerImage) ? req.files.buyerImage : [];
        if (buyerImages.length === 0) {
            throw new ApiError(422, 'Client image is required');
        }

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
            userId: req.user.id,
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
        let userType = req.user?.type || null;

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
                userType = payload.type || null;
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
                    userType = payload.type || null;
                } else if (payload?.typ === 'agreement_approval') {
                    if (payload?.agreementId !== agreement.id) throw new ApiError(401, 'Token agreement mismatch');
                    if (payload?.buyerId !== agreement.buyer?.id) throw new ApiError(401, 'Token buyer mismatch');

                    // Treat this as an individual (buyer) for the purpose of access checks.
                    userId = agreement.buyer?.user?.id;
                    userType = 'INDIVIDUAL';
                } else {
                    throw new ApiError(401, 'Invalid token type');
                }
            }
        }

        const isAdmin = userType === 'ADMIN';
        const isSeller = agreement.seller?.user?.id && agreement.seller.user.id === userId;
        const isBuyer = agreement.buyer?.user?.id && agreement.buyer.user.id === userId;
        if (!isAdmin && !isSeller && !isBuyer) throw new ApiError(403, 'Forbidden');

        // Pre-fetch remote images (server-side, avoids browser canvas/CORS issues)
        const device = agreement.deviceDetails || agreement.device;
        const termsObj = safeJsonParse(agreement.terms);

        const sellerLogoUrl = agreement.seller?.logoUrl || null;
        const buyerPhotoUrl = termsObj?.client?.photo?.url || null;
        const snapshotImages = Array.isArray(agreement.deviceSnapshot?.images) ? agreement.deviceSnapshot.images : [];
        const deviceImageUrls = (device?.images || [])
            .map((img) => img?.url)
            .filter(Boolean)
            .slice(0, 4);
        const fallbackDeviceImageUrls = snapshotImages
            .map((img) => img?.url)
            .filter(Boolean)
            .slice(0, 4);
        const exchangeImageUrls = (termsObj?.exchange?.clientPhone?.images || []).map((img) => img?.url).filter(Boolean).slice(0, 4);

        const [sellerLogoBuf, buyerPhotoBuf, deviceBufs, exchangeBufs] = await Promise.all([
            sellerLogoUrl ? fetchImageBuffer(sellerLogoUrl).catch(() => null) : Promise.resolve(null),
            buyerPhotoUrl ? fetchImageBuffer(buyerPhotoUrl).catch(() => null) : Promise.resolve(null),
            Promise.all((deviceImageUrls.length > 0 ? deviceImageUrls : fallbackDeviceImageUrls).map((u) => fetchImageBuffer(u).catch(() => null))),
            Promise.all(exchangeImageUrls.map((u) => fetchImageBuffer(u).catch(() => null)))
        ]);

        // Buffer the full PDF in memory before sending.
        // This ensures a complete, valid PDF is sent — streaming directly to res
        // can produce a corrupted file if any error occurs mid-generation.
        const pdfBuffer = await new Promise((resolve, reject) => {
            const chunks = [];
            const doc = new PDFDocument({ size: 'A4', margin: 50 });

            doc.on('data', (chunk) => chunks.push(chunk));
            doc.on('end', () => resolve(Buffer.concat(chunks)));
            doc.on('error', reject);

            // Header
            const headerTop = 34;
            const headerLeft = doc.page.margins.left;
            const headerRight = doc.page.width - doc.page.margins.right;
            const headerWidth = headerRight - headerLeft;

            doc.rect(0, 0, doc.page.width, 165).fill(PDF_STYLE.colors.navy);
            doc.rect(0, 162, doc.page.width, 3).fill(PDF_STYLE.colors.gold);

            // Logo (read from frontend assets in this workspace)
            const logoPath = path.resolve(__dirname, '../../../frontend/src/images/E-Nyandiko.png');
            if (fs.existsSync(logoPath)) {
                try {
                    doc.image(logoPath, headerLeft, headerTop, { width: 38 });
                } catch {
                    // ignore logo errors
                }
            }

            doc
                .font('Times-Bold')
                .fontSize(PDF_STYLE.sizes.h1)
                .fillColor('#ffffff')
                .text('Agreement Document', headerLeft + 60, headerTop - 2, {
                    width: headerWidth - 60,
                    align: 'left'
                });

            doc
                .font('Helvetica')
                .fontSize(PDF_STYLE.sizes.body)
                .fillOpacity(0.72)
                .fillColor('#ffffff')
                .text(`Agreement ID: ${agreement.id}`, headerLeft + 60, headerTop + 24, {
                    width: headerWidth - 60,
                    align: 'left'
                });
            doc.fillOpacity(1);

            // Status pill (right-aligned)
            const statusText = `Status: ${agreement.status || '-'}`;
            const pillY = headerTop + 18;
            const pillX = headerRight - measurePill(doc, statusText).w;
            drawPill(doc, pillX, pillY, statusText, {
                bg: agreement.status === 'ACCEPTED' ? PDF_STYLE.colors.successSoft : PDF_STYLE.colors.goldSoft,
                fg: agreement.status === 'ACCEPTED' ? PDF_STYLE.colors.success : '#854f0b'
            });

            // Reset cursor to normal flow after absolute-positioned header elements
            doc.x = headerLeft;
            doc.y = 174;
            drawDivider(doc);
            doc.moveDown(1);

            doc
                .font('Helvetica')
                .fontSize(PDF_STYLE.sizes.small)
                .fillColor(PDF_STYLE.colors.muted)
                .text(`Generated on ${new Date().toLocaleString()}`, headerLeft, doc.y, {
                    width: headerRight - headerLeft,
                    align: 'right'
                });
            doc.moveDown(0.6);
            doc.fillColor(PDF_STYLE.colors.text);

            drawWatermark(doc);

            sectionTitle(doc, '1', 'Parties to the Agreement');

            const sellerUser = agreement.seller?.user;
            const buyerUser = agreement.buyer?.user;

            doc.font('Helvetica-Bold').fontSize(PDF_STYLE.sizes.body).text('Seller / Vendor');
            doc.moveDown(0.3);
            renderKeyValueTwoCol(doc, [
                { label: 'Business name', value: agreement.seller?.businessName },
                { label: 'TIN', value: agreement.seller?.tinNumber },
                { label: 'Full name', value: sellerUser?.fullName },
                { label: 'Email', value: sellerUser?.email },
                { label: 'Phone', value: agreement.seller?.phone || sellerUser?.phone },
                { label: 'WhatsApp', value: agreement.seller?.whatsapp },
                { label: 'Location', value: agreement.seller?.location },
                { label: 'Floor', value: agreement.seller?.floor }
            ]);
            if (sellerLogoBuf) {
                addImageGrid(doc, 'Seller logo', [sellerLogoBuf]);
            }
            doc.moveDown(0.3);

            doc.font('Helvetica-Bold').fontSize(PDF_STYLE.sizes.body).text('Buyer / Client');
            doc.moveDown(0.3);
            renderKeyValueTwoCol(doc, [
                { label: 'Full name', value: buyerUser?.fullName },
                { label: 'Email', value: buyerUser?.email },
                { label: 'National ID', value: buyerUser?.nationalId },
                { label: 'Client code', value: buyerUser?.clientCode },
                { label: 'Client location', value: termsObj?.client?.location }
            ]);
            if (buyerPhotoBuf) {
                addImageGrid(doc, 'Buyer photo', [buyerPhotoBuf]);
            }
            doc.moveDown(1);

            sectionTitle(doc, '2', 'Device Information');
            renderKeyValueTwoCol(doc, [
                { label: 'Type', value: device?.deviceType?.name },
                { label: 'Title', value: device?.title },
                { label: 'Device ID', value: device?.id }
            ]);

            if (device?.fieldValues && Array.isArray(device.fieldValues) && device.fieldValues.length > 0) {
                doc.moveDown(0.4);
                    doc.font('Helvetica-Bold').fontSize(PDF_STYLE.sizes.body).text('Device Details');
                doc.font('Helvetica').fontSize(PDF_STYLE.sizes.body).fillColor(PDF_STYLE.colors.text);
                for (const fv of device.fieldValues) {
                    const key = fv.deviceField?.label || fv.deviceField?.key || 'Field';
                    const value = typeof fv.value === 'object' ? JSON.stringify(fv.value) : String(fv.value);
                    doc
                        .fillColor(PDF_STYLE.colors.muted)
                        .text(`• ${key}: `, { continued: true })
                        .fillColor(PDF_STYLE.colors.text)
                        .text(value);
                }
                doc.fillColor(PDF_STYLE.colors.text);
            }

            if (deviceBufs && deviceBufs.filter(Boolean).length > 0) {
                addImageGrid(doc, 'Device photos', deviceBufs);
            }

            doc.moveDown(1);
            sectionTitle(doc, '3', 'Financial Terms');
            renderKeyValueTwoCol(doc, [
                { label: 'Price', value: `${agreement.price} ${agreement.currency}` },
                { label: 'Created', value: agreement.createdAt ? new Date(agreement.createdAt).toLocaleString() : '-' },
                { label: 'Confirmed', value: agreement.acceptedAt ? new Date(agreement.acceptedAt).toLocaleString() : '-' },
                { label: 'Currency', value: agreement.currency }
            ]);
            doc.moveDown(0.4);

            if (termsObj) {
                sectionTitle(doc, '4', 'Terms & Conditions');
                doc.font('Helvetica').fontSize(PDF_STYLE.sizes.body).fillColor(PDF_STYLE.colors.text);

                const tx = termsObj.transactionType || '-';
                doc.fillColor(PDF_STYLE.colors.muted).text('Transaction type:', { continued: true });
                doc.fillColor(PDF_STYLE.colors.text).text(` ${tx}`);

                if (termsObj?.client && typeof termsObj.client === 'object') {
                    const c = termsObj.client;
                    if (c.location) {
                        doc.fillColor(PDF_STYLE.colors.muted).text('Client location:', { continued: true });
                        doc.fillColor(PDF_STYLE.colors.text).text(` ${c.location}`);
                    }
                }

                if (termsObj?.warranty && typeof termsObj.warranty === 'object') {
                    const w = termsObj.warranty;
                    const months = w.months !== null && w.months !== undefined ? String(w.months) : '-';
                    doc.fillColor(PDF_STYLE.colors.muted).text('Warranty months:', { continued: true });
                    doc.fillColor(PDF_STYLE.colors.text).text(` ${months}`);
                    if (w.details) {
                        doc.fillColor(PDF_STYLE.colors.muted).text('Warranty details:');
                        doc.fillColor(PDF_STYLE.colors.text).text(String(w.details));
                    }
                }

                if (termsObj?.conditions) {
                    doc.moveDown(0.5);
                    doc.font('Helvetica-Bold').fontSize(PDF_STYLE.sizes.body).fillColor(PDF_STYLE.colors.text).text('Conditions');
                    doc.font('Helvetica').fontSize(PDF_STYLE.sizes.body).fillColor(PDF_STYLE.colors.text).text(String(termsObj.conditions));
                }

                if (tx === 'BUY' && termsObj?.topUpPlan) {
                    doc.moveDown(0.5);
                    doc.font('Helvetica-Bold').fontSize(PDF_STYLE.sizes.body).text('Top-up plan');
                    doc.font('Helvetica').fontSize(PDF_STYLE.sizes.body).text(String(termsObj.topUpPlan));
                }

                if (termsObj?.transactionType === 'EXCHANGE' && exchangeBufs && exchangeBufs.filter(Boolean).length > 0) {
                    addImageGrid(doc, 'Trade-in device photos', exchangeBufs);
                }
            } else {
                sectionTitle(doc, '4', 'Terms & Conditions');
                doc.font('Helvetica').fontSize(PDF_STYLE.sizes.body).text(String(agreement.terms || '-'));
            }

            doc.moveDown(1);
            sectionTitle(doc, '5', 'Signatures & Acknowledgement');
            const sigStartY = doc.y + 10;
            const sigColWidth = (doc.page.width - doc.page.margins.left - doc.page.margins.right - 32) / 2;
            const leftSigX = doc.page.margins.left;
            const rightSigX = leftSigX + sigColWidth + 32;

            function drawSignatureBlock(x, name, role) {
                const baseY = sigStartY;
                doc.save();
                doc.dash(4, { space: 3 }).moveTo(x, baseY + 34).lineTo(x + sigColWidth, baseY + 34).strokeColor('#9ca3af').stroke();
                doc.undash();
                doc.fillColor(PDF_STYLE.colors.text).font('Helvetica-Bold').fontSize(12).text(name || '-', x, baseY + 44, { width: sigColWidth });
                doc.font('Helvetica').fontSize(10).fillColor(PDF_STYLE.colors.muted).text(role, x, baseY + 60, { width: sigColWidth });
                doc.font('Helvetica').fontSize(10).fillColor(PDF_STYLE.colors.muted).text('Date: _______________', x, baseY + 80, { width: sigColWidth });
                doc.restore();
            }

            drawSignatureBlock(leftSigX, agreement.seller?.businessName || sellerUser?.fullName, 'Seller / Authorized Representative');
            drawSignatureBlock(rightSigX, buyerUser?.fullName, 'Buyer / Client');

            doc.moveDown(5.5);

            doc.save();
            doc.circle(rightSigX + sigColWidth - 36, sigStartY + 70, 32).lineWidth(1.5).strokeColor('#d1d5db').stroke();
            doc.font('Helvetica-Bold').fontSize(8).fillColor('#c7cdd6').text('Official\nStamp', rightSigX + sigColWidth - 60, sigStartY + 58, {
                width: 48,
                align: 'center'
            });
            doc.restore();

            doc.moveDown(2);
            drawDivider(doc);
            doc.moveDown(0.6);
            doc
                .fontSize(PDF_STYLE.sizes.small)
                .font('Helvetica')
                .fillColor(PDF_STYLE.colors.muted)
                .text('This is a legally binding agreement between the parties identified above. Generated by the E-Nyandiko platform. Any disputes shall be resolved under applicable commercial law.', { align: 'center' });
            doc.fillColor(PDF_STYLE.colors.text);

            doc.end();
        });

        res.setHeader('Content-Type', 'application/pdf');
        const dl = String(req.query?.download || '').toLowerCase();
        const isDownload = dl === '1' || dl === 'true' || dl === 'yes';
        res.setHeader('Content-Disposition', `${isDownload ? 'attachment' : 'inline'}; filename="agreement-${agreement.id}.pdf"`);
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
        const userType = req.user?.type || null;
        if (!userId) throw new ApiError(401, 'Missing Authorization');

        const isAdmin = userType === 'ADMIN';
        const isSeller = agreement.seller?.user?.id && agreement.seller.user.id === userId;
        const isBuyer = agreement.buyer?.user?.id && agreement.buyer.user.id === userId;
        if (!isAdmin && !isSeller && !isBuyer) throw new ApiError(403, 'Forbidden');

        // Short-lived token: safe to use in query string for viewing the PDF.
        const token = jwt.sign(
            {
                typ: 'agreement_document',
                agreementId: agreement.id,
                type: userType
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
            userType: req.user?.type || null
        });
        return ok(res, { message: 'Agreement', data: agreement });
    } catch (err) {
        return next(err);
    }
}

async function deleteAgreement(req, res, next) {
    try {
        const { id } = req.params;
        const result = await agreementService.deleteAgreement({
            userId: req.user.id,
            sellerId: req.user.sellerId,
            agreementId: id
        });
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
