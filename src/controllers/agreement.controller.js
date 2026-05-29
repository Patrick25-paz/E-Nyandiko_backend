const agreementService = require('../services/agreement.service');
const { created, ok } = require('../utils/response');
const { ApiError } = require('../utils/errors');
const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');
const jwt = require('jsonwebtoken');
const env = require('../config/env');

// ─────────────────────────────────────────────
// DESIGN TOKENS
// ─────────────────────────────────────────────
const C = {
    navy:        '#0f2444',
    gold:        '#c9a227',
    goldLight:   '#f4ead0',
    white:       '#ffffff',
    text:        '#1a1a1a',
    muted:       '#666666',
    mutedLight:  '#999999',
    border:      '#d8d5cc',
    surface:     '#fafaf8',
    surfaceAlt:  '#f5f3ee',
    success:     '#3b6d11',
    successBg:   '#eaf3de',
    successBdr:  '#97c459',
    warning:     '#854f0b',
    warningBg:   '#faeeda',
    warningBdr:  '#efaa27',
    stampRing:   '#d1d5db',
    stampText:   '#c7cdd6',
};

const FONT = {
    h1:    22,
    h2:    11,
    body:  10,
    small: 9,
    tiny:  8,
};

const PAGE_MARGIN = 50;

// ─────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────

/** Add a new page if remaining space is less than neededHeight */
function ensureSpace(doc, neededHeight) {
    const bottomPadding = 70;
    if ((doc.y || 0) + neededHeight > doc.page.height - bottomPadding) {
        doc.addPage();
        doc.y = PAGE_MARGIN + 20;
    }
}

/** Horizontal rule */
function drawDivider(doc, { color = C.border, thickness = 0.5 } = {}) {
    const x1 = PAGE_MARGIN;
    const x2 = doc.page.width - PAGE_MARGIN;
    doc.save()
        .moveTo(x1, doc.y)
        .lineTo(x2, doc.y)
        .lineWidth(thickness)
        .strokeColor(color)
        .stroke()
        .restore();
}

/** Filled rounded-rect pill — safe for use inside the navy header */
function drawPill(doc, x, y, text, { bg, fg } = {}) {
    const pX = 9, pY = 4, r = 8;
    // Measure BEFORE save so font state is correct
    doc.font('Helvetica-Bold').fontSize(FONT.small);
    const w   = doc.widthOfString(text) + pX * 2;
    const lh  = doc.currentLineHeight();
    const h   = lh + pY * 2;

    // 1. Draw background rect (no save/restore — we handle state manually)
    doc.roundedRect(x, y, w, h, r).fillColor(bg || C.goldLight).fill();

    // 2. Draw text — set color explicitly, never rely on restored state
    doc.font('Helvetica-Bold').fontSize(FONT.small)
        .fillColor(fg || C.warning)
        .text(text, x + pX, y + pY, { lineBreak: false, width: w - pX * 2 });

    // 3. Reset to default body color
    doc.fillColor(C.text);

    return { w, h };
}

function pillWidth(doc, text) {
    doc.font('Helvetica-Bold').fontSize(FONT.small);
    return doc.widthOfString(text) + 18; // pX*2 + a little breathing room
}

/** Faint diagonal watermark */
function drawWatermark(doc) {
    doc.save()
        .fillOpacity(0.035)
        .font('Times-Bold')
        .fontSize(72)
        .fillColor(C.navy)
        .rotate(-30, { origin: [doc.page.width / 2, doc.page.height / 2] })
        .text('E-NYANDIKO', doc.page.width / 2 - 220, doc.page.height / 2 - 40, {
            width: 440,
            align: 'center',
            lineBreak: false,
        })
        .fillOpacity(1)
        .restore();
}

/**
 * Numbered section header:  ● N   TITLE TEXT
 */
function sectionTitle(doc, number, title) {
    ensureSpace(doc, 36);
    const y      = doc.y + 2;
    const badgeR = 11;
    const badgeCX = PAGE_MARGIN + badgeR;
    const textX   = PAGE_MARGIN + badgeR * 2 + 10;
    const textW   = doc.page.width - PAGE_MARGIN * 2 - badgeR * 2 - 10;

    doc.save()
        .circle(badgeCX, y + badgeR, badgeR)
        .fillColor(C.navy)
        .fill()
        .font('Helvetica-Bold').fontSize(10).fillColor(C.gold)
        .text(String(number), PAGE_MARGIN, y + 4, { width: badgeR * 2, align: 'center', lineBreak: false })
        .restore();

    doc.font('Helvetica-Bold')
        .fontSize(FONT.h2)
        .fillColor(C.navy)
        .text(String(title).toUpperCase(), textX, y + 4, {
            width: textW,
            characterSpacing: 0.8,
            lineBreak: false,
        });

    doc.y = y + badgeR * 2 + 4;
    drawDivider(doc);
    doc.moveDown(0.5);
    doc.fillColor(C.text);
}

/**
 * A single row in a "terms table":  label col | value col  with alternating bg
 */
function termsRow(doc, label, value, { even = false, labelWidth = 140 } = {}) {
    ensureSpace(doc, 22);
    const x      = PAGE_MARGIN;
    const rowW   = doc.page.width - PAGE_MARGIN * 2;
    const valX   = x + labelWidth;
    const valW   = rowW - labelWidth;
    const padY   = 5;

    // measure row height
    doc.font('Helvetica').fontSize(FONT.body);
    const valH  = doc.heightOfString(value || '-', { width: valW });
    const rowH  = Math.max(valH, doc.currentLineHeight()) + padY * 2;

    if (even) {
        doc.save()
            .rect(x, doc.y, rowW, rowH)
            .fillColor(C.surface)
            .fill()
            .restore();
    }

    const rowY = doc.y + padY;

    doc.font('Helvetica').fontSize(FONT.body).fillColor(C.muted)
        .text(label, x + 8, rowY, { width: labelWidth - 12, lineBreak: false });

    doc.font('Helvetica-Bold').fontSize(FONT.body).fillColor(C.text)
        .text(value || '-', valX, rowY, { width: valW - 8 });

    doc.y += rowH;
    doc.x  = PAGE_MARGIN;

    // thin bottom border
    doc.save()
        .moveTo(x, doc.y)
        .lineTo(x + rowW, doc.y)
        .lineWidth(0.3)
        .strokeColor(C.border)
        .stroke()
        .restore();
}

/**
 * Draw a rounded-rect "card" outline.
 * Returns { x, y, w, h } so caller can place content inside.
 */
function drawCard(doc, x, y, w, h, { topColor = C.navy } = {}) {
    doc.save()
        .roundedRect(x, y, w, h, 6)
        .fillColor(C.surface)
        .fill()
        .roundedRect(x, y, w, h, 6)
        .lineWidth(0.5)
        .strokeColor(C.border)
        .stroke()
        // colored top accent bar
        .rect(x, y, w, 3)
        .fillColor(topColor)
        .fill()
        .restore();
}

/**
 * Render a two-column party card pair (Seller | Buyer).
 * Returns the Y position after the cards.
 */
function drawPartyCards(doc, sellerData, buyerData, sellerLogoBuf, buyerPhotoBuf) {
    const gap    = 14;
    const totalW = doc.page.width - PAGE_MARGIN * 2;
    const cardW  = (totalW - gap) / 2;

    // First measure how tall each card needs to be
    const lineH  = FONT.body * 1.4;
    const itemsS = sellerData.filter(Boolean).length;
    const itemsB = buyerData.filter(Boolean).length;
    const photoH = 90; // photo/logo slot
    const padT   = 18; // top padding inside card (below accent bar)
    const padB   = 14;
    const cardH  = Math.max(
        padT + padB + lineH * 2 + 8 + photoH + 6 + itemsS * (lineH + 3),
        padT + padB + lineH * 2 + 8 + photoH + 6 + itemsB * (lineH + 3),
        160
    );

    ensureSpace(doc, cardH + 16);

    const startY = doc.y;
    const leftX  = PAGE_MARGIN;
    const rightX = PAGE_MARGIN + cardW + gap;

    drawCard(doc, leftX,  startY, cardW, cardH, { topColor: C.navy });
    drawCard(doc, rightX, startY, cardW, cardH, { topColor: C.gold });

    function fillCard(x, roleLabel, nameLine, photo, buf, items) {
        let cy = startY + padT;

        // Role label
        doc.font('Helvetica-Bold').fontSize(FONT.tiny).fillColor(C.muted)
            .text(roleLabel.toUpperCase(), x + 12, cy, { width: cardW - 24, characterSpacing: 0.7, lineBreak: false });
        cy += lineH;

        // Name
        doc.font('Helvetica-Bold').fontSize(13).fillColor(C.text)
            .text(nameLine || '-', x + 12, cy, { width: cardW - 24 });
        cy = doc.y + 6;

        // Photo / logo
        const photoW = 62;
        const photoH_ = 80;
        if (buf) {
            try {
                doc.save()
                    .rect(x + 12, cy, photoW, photoH_)
                    .lineWidth(0.5).strokeColor(C.border).stroke();
                doc.image(buf, x + 12, cy, { fit: [photoW, photoH_], align: 'center', valign: 'center' });
                doc.restore();
            } catch { /* ignore bad image */ }
        } else {
            // placeholder box
            doc.save()
                .rect(x + 12, cy, photoW, photoH_)
                .fillColor('#f0efe9').fill()
                .rect(x + 12, cy, photoW, photoH_)
                .lineWidth(0.5).strokeColor(C.border).stroke()
                .font('Helvetica').fontSize(FONT.tiny).fillColor(C.mutedLight)
                .text(photo, x + 12, cy + photoH_ / 2 - 5, { width: photoW, align: 'center' })
                .restore();
        }
        cy += photoH_ + 10;

        // Key-value rows
        for (const item of items.filter(Boolean)) {
            if (!item.value) continue;
            doc.font('Helvetica').fontSize(FONT.small).fillColor(C.muted)
                .text(item.label, x + 12, cy, { width: cardW - 24, lineBreak: false, continued: false });
            cy = doc.y;
            doc.font('Helvetica-Bold').fontSize(FONT.small).fillColor(C.text)
                .text(item.value, x + 12, cy, { width: cardW - 24 });
            cy = doc.y + 2;
        }
    }

    fillCard(leftX,  'Seller / Vendor',  sellerData[0]?.value, 'Seller logo',  sellerLogoBuf, sellerData.slice(1));
    fillCard(rightX, 'Buyer / Client',   buyerData[0]?.value,  'Buyer photo',  buyerPhotoBuf, buyerData.slice(1));

    doc.x = PAGE_MARGIN;
    doc.y = startY + cardH + 14;
}

function addImageGrid(doc, title, buffers) {
    const list = (buffers || []).filter(Boolean);
    if (list.length === 0) return;

    const gap     = 12;
    const usableW = doc.page.width - PAGE_MARGIN * 2;
    const cols    = 2;
    const colW    = (usableW - gap) / cols;
    const colH    = 140;

    ensureSpace(doc, colH + 40);
    doc.moveDown(0.5);
    doc.font('Helvetica-Bold').fontSize(FONT.small).fillColor(C.muted)
        .text(title.toUpperCase(), { characterSpacing: 0.7 });
    doc.moveDown(0.3);

    let x   = PAGE_MARGIN;
    let y   = doc.y;
    let col = 0;

    for (const buf of list.slice(0, 6)) {
        if (y + colH > doc.page.height - 70) {
            doc.addPage();
            x = PAGE_MARGIN; y = PAGE_MARGIN + 20; col = 0;
        }
        try {
            doc.save()
                .roundedRect(x, y, colW, colH, 4)
                .fillColor(C.surface).fill()
                .roundedRect(x, y, colW, colH, 4)
                .lineWidth(0.5).strokeColor(C.border).stroke()
                .restore();
            doc.image(buf, x + 4, y + 4, {
                fit: [colW - 8, colH - 8],
                align: 'center', valign: 'center',
            });
        } catch { /* skip bad image */ }

        col += 1;
        if (col >= cols) { col = 0; x = PAGE_MARGIN; y += colH + gap; }
        else               { x += colW + gap; }
    }

    doc.x = PAGE_MARGIN;
    doc.y = y + colH + 8;
}

function safeJsonParse(text) {
    if (!text || typeof text !== 'string') return null;
    try { return JSON.parse(text); } catch { return null; }
}

// ─────────────────────────────────────────────
// IMAGE FETCH
// ─────────────────────────────────────────────

function normalizeCloudinaryImageUrl(url) {
    if (!url || typeof url !== 'string') return null;
    const s = url.trim();
    if (!/^https?:\/\//i.test(s)) return null;
    if (s.includes('res.cloudinary.com') && s.includes('/image/upload/')) {
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
            signal: controller.signal,
        });
        if (!res.ok) return null;
        const ct = String(res.headers.get('content-type') || '').toLowerCase();
        if (!ct.startsWith('image/') || ct.includes('svg')) return null;
        const buf = Buffer.from(await res.arrayBuffer());
        return buf.length === 0 || buf.length > maxBytes ? null : buf;
    } catch { return null; }
    finally { clearTimeout(timeout); }
}

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

        // ── Data extraction ───────────────────────────────────────────────────
        const device      = agreement.deviceDetails || agreement.device;
        const termsObj    = safeJsonParse(agreement.terms);
        const sellerUser  = agreement.seller?.user;
        const buyerUser   = agreement.buyer?.user;
        const txType      = termsObj?.transactionType || '-';

        const sellerLogoUrl  = agreement.seller?.logoUrl || null;
        const buyerPhotoUrl  = termsObj?.client?.photo?.url || null;
        const snapshotImgs   = Array.isArray(agreement.deviceSnapshot?.images) ? agreement.deviceSnapshot.images : [];
        const deviceImgUrls  = (device?.images || []).map((i) => i?.url).filter(Boolean).slice(0, 4);
        const fallbackUrls   = snapshotImgs.map((i) => i?.url).filter(Boolean).slice(0, 4);
        const exchangeImgUrls = (termsObj?.exchange?.clientPhone?.images || []).map((i) => i?.url).filter(Boolean).slice(0, 4);

        const [sellerLogoBuf, buyerPhotoBuf, deviceBufs, exchangeBufs] = await Promise.all([
            sellerLogoUrl  ? fetchImageBuffer(sellerLogoUrl).catch(() => null)  : null,
            buyerPhotoUrl  ? fetchImageBuffer(buyerPhotoUrl).catch(() => null)  : null,
            Promise.all((deviceImgUrls.length > 0 ? deviceImgUrls : fallbackUrls).map((u) => fetchImageBuffer(u).catch(() => null))),
            Promise.all(exchangeImgUrls.map((u) => fetchImageBuffer(u).catch(() => null))),
        ]);

        // ── Build PDF ────────────────────────────────────────────────────────
        const pdfBuffer = await new Promise((resolve, reject) => {
            const chunks = [];
            const doc = new PDFDocument({ size: 'A4', margin: PAGE_MARGIN, autoFirstPage: true });
            doc.on('data',  (c) => chunks.push(c));
            doc.on('end',   ()  => resolve(Buffer.concat(chunks)));
            doc.on('error', reject);

            const pageW = doc.page.width;
            const bodyW = pageW - PAGE_MARGIN * 2;

            // ── HEADER BAND ──────────────────────────────────────────────────
            const headerH = 160;
            doc.rect(0, 0, pageW, headerH).fillColor(C.navy).fill();
            // gold accent stripe
            doc.rect(0, headerH - 3, pageW, 3).fillColor(C.gold).fill();

            // E-Nyandiko logo
            const logoPath = path.resolve(__dirname, '../../../frontend/src/images/E-Nyandiko.png');
            if (fs.existsSync(logoPath)) {
                try { doc.image(logoPath, PAGE_MARGIN, 32, { width: 36 }); } catch { /* ignore */ }
            }

            // Brand label
            doc.font('Helvetica-Bold').fontSize(FONT.small)
                .fillColor(C.gold)
                .text('E-NYANDIKO', PAGE_MARGIN + 46, 33, { characterSpacing: 1.2, lineBreak: false });
            doc.font('Helvetica').fontSize(FONT.tiny)
                .fillColor('#8aaac8')   // solid muted-blue (PDFKit ignores rgba)
                .text('Official Agreement Document', PAGE_MARGIN + 46, 33 + FONT.small + 3, { lineBreak: false });

            // Transaction type pill (top-right) — solid bg so it shows on dark header
            const txLabel  = txType === 'EXCHANGE' ? 'EXCHANGE AGREEMENT' : 'SALE AGREEMENT';
            const txPillW  = pillWidth(doc, txLabel);
            drawPill(doc, pageW - PAGE_MARGIN - txPillW, 28, txLabel, {
                bg: '#1e3d5c',   // solid darker-navy, gold text pops clearly
                fg: C.gold,
            });

            // Status pill (below tx pill) — solid pastel bg colors only
            const statusLabel = agreement.status || 'PENDING';
            const accepted    = agreement.status === 'ACCEPTED' || agreement.status === 'COMPLETED';
            const stPillW     = pillWidth(doc, statusLabel);
            drawPill(doc, pageW - PAGE_MARGIN - stPillW, 52, statusLabel, {
                bg: accepted ? C.successBg : C.warningBg,
                fg: accepted ? C.success   : C.warning,
            });

            // Document title
            const deviceLabel = `${device?.deviceType?.name || 'Device'}${device?.title ? ` — ${device.title}` : ''}`;
            doc.font('Times-BoldItalic').fontSize(FONT.h1)
                .fillColor(C.white)
                .text(`Agreement for ${deviceLabel}`, PAGE_MARGIN, 76, { width: bodyW - 120 });

            // Meta row at the bottom of the header
            const metaY = headerH - 38;
            const metaCols = [
                { label: 'Agreement ID', value: String(agreement.id) },
                { label: 'Date Created', value: agreement.createdAt ? new Date(agreement.createdAt).toLocaleString() : '-' },
                { label: 'Date Confirmed', value: agreement.acceptedAt ? new Date(agreement.acceptedAt).toLocaleString() : '-' },
            ];
            const metaColW = bodyW / metaCols.length;
            metaCols.forEach(({ label, value }, i) => {
                const mx = PAGE_MARGIN + i * metaColW;
                doc.font('Helvetica').fontSize(FONT.tiny).fillColor('#8aaac8')  // solid, no rgba
                    .text(label.toUpperCase(), mx, metaY, { width: metaColW - 8, characterSpacing: 0.5, lineBreak: false });
                doc.font('Helvetica-Bold').fontSize(FONT.small).fillColor(C.white)
                    .text(value, mx, metaY + 11, { width: metaColW - 8, lineBreak: false });
            });

            // ── Reset cursor to immediately below header — no gap ────────────
            doc.x = PAGE_MARGIN;
            doc.y = headerH + 10;   // tight: just 10pt breathing room
            drawWatermark(doc);

            // Generated-on line (compact)
            doc.font('Helvetica').fontSize(FONT.tiny).fillColor(C.mutedLight)
                .text(`Generated on ${new Date().toLocaleString()}`, PAGE_MARGIN, doc.y, {
                    width: bodyW, align: 'right',
                });
            doc.moveDown(0.5);

            // Recital — measure text height first so the gold bar matches it exactly
            const recitalText = `This agreement is entered into between the Seller and the Buyer identified herein, and constitutes a legally binding contract for the device described below. Transaction type: ${txType}.`;
            doc.font('Times-Italic').fontSize(FONT.body);
            const recitalH = doc.heightOfString(recitalText, { width: bodyW - 16 });
            const recitalY = doc.y;

            // Gold left-accent bar — same height as text, no save/restore
            doc.rect(PAGE_MARGIN, recitalY, 3, recitalH + 4).fillColor(C.gold).fill();

            // Light background behind recital
            doc.rect(PAGE_MARGIN + 3, recitalY - 2, bodyW - 3, recitalH + 8)
                .fillColor(C.surface).fill();

            doc.font('Times-Italic').fontSize(FONT.body).fillColor('#444444')
                .text(recitalText, PAGE_MARGIN + 14, recitalY + 2, { width: bodyW - 18 });

            doc.y = recitalY + recitalH + 14;
            doc.moveDown(0.5);

            // ── SECTION 1: PARTIES ──────────────────────────────────────────
            sectionTitle(doc, 1, 'Parties to the Agreement');

            const sellerFields = [
                { label: 'Name',      value: agreement.seller?.businessName },
                { label: 'TIN',       value: agreement.seller?.tinNumber },
                { label: 'Contact',   value: sellerUser?.fullName },
                { label: 'Email',     value: sellerUser?.email },
                { label: 'Phone',     value: agreement.seller?.phone || sellerUser?.phone },
                { label: 'WhatsApp',  value: agreement.seller?.whatsapp },
                { label: 'Location',  value: agreement.seller?.location },
                { label: 'Floor',     value: agreement.seller?.floor },
            ];
            const buyerFields = [
                { label: 'Name',        value: buyerUser?.fullName },
                { label: 'Email',       value: buyerUser?.email },
                { label: 'National ID', value: buyerUser?.nationalId },
                { label: 'Client code', value: buyerUser?.clientCode },
                { label: 'Location',    value: termsObj?.client?.location },
            ];

            drawPartyCards(doc, sellerFields, buyerFields, sellerLogoBuf, buyerPhotoBuf);

            // ── SECTION 2: DEVICE ──────────────────────────────────────────
            sectionTitle(doc, 2, 'Device Information');

            // Terms table
            const deviceRows = [
                { label: 'Type',  value: device?.deviceType?.name },
                { label: 'Title', value: device?.title || 'N/A' },
            ];
            deviceRows.forEach(({ label, value }, i) => termsRow(doc, label, value, { even: i % 2 === 0 }));

            if (Array.isArray(device?.fieldValues) && device.fieldValues.length > 0) {
                doc.moveDown(0.4);
                doc.font('Helvetica-Bold').fontSize(FONT.small).fillColor(C.muted)
                    .text('SPECIFICATIONS', { characterSpacing: 0.7 });
                doc.moveDown(0.2);
                device.fieldValues.forEach((fv, i) => {
                    const key = fv.deviceField?.label || fv.deviceField?.key || 'Field';
                    const val = typeof fv.value === 'object' ? JSON.stringify(fv.value) : String(fv.value ?? '-');
                    termsRow(doc, key, val, { even: i % 2 === 0 });
                });
            }

            if (deviceBufs?.filter(Boolean).length > 0) {
                addImageGrid(doc, 'Device Photos', deviceBufs);
            }

            doc.moveDown(0.8);

            // ── SECTION 3: FINANCIAL TERMS ─────────────────────────────────
            sectionTitle(doc, 3, 'Financial Terms');

            // Amount highlight row
            ensureSpace(doc, 30);
            const amtRowH = 30;
            doc.save()
                .rect(PAGE_MARGIN, doc.y, bodyW, amtRowH)
                .fillColor(C.surface).fill()
                .restore();
            const amtY = doc.y + 7;
            doc.font('Helvetica').fontSize(FONT.body).fillColor(C.muted)
                .text('Total Amount', PAGE_MARGIN + 8, amtY, { width: 140, lineBreak: false });
            doc.font('Times-Bold').fontSize(16).fillColor(C.navy)
                .text(String(agreement.price || '-'), PAGE_MARGIN + 148, amtY - 2, { continued: true })
                .font('Helvetica').fontSize(FONT.body).fillColor(C.muted)
                .text(`  ${agreement.currency || ''}`, { lineBreak: false });
            doc.y += amtRowH;
            doc.save().moveTo(PAGE_MARGIN, doc.y).lineTo(PAGE_MARGIN + bodyW, doc.y)
                .lineWidth(0.3).strokeColor(C.border).stroke().restore();

            termsRow(doc, 'Date Created',   agreement.createdAt  ? new Date(agreement.createdAt).toLocaleString()  : '-', { even: true });
            termsRow(doc, 'Date Confirmed', agreement.acceptedAt ? new Date(agreement.acceptedAt).toLocaleString() : '-', { even: false });

            doc.moveDown(0.8);

            // ── SECTION 4: TERMS & CONDITIONS ──────────────────────────────
            sectionTitle(doc, 4, 'Terms & Conditions');

            if (termsObj) {
                termsRow(doc, 'Transaction Type', txType, { even: true });

                if (termsObj.price?.amount) {
                    termsRow(doc, 'Amount (terms)',
                        `${termsObj.price.amount} ${termsObj.price.currency || agreement.currency || ''}`,
                        { even: false });
                }
                if (termsObj.warranty) {
                    termsRow(doc, 'Warranty Period',  `${termsObj.warranty.months || '-'} months`, { even: true });
                    if (termsObj.warranty.details) {
                        termsRow(doc, 'Warranty Details', String(termsObj.warranty.details), { even: false });
                    }
                }
                if (termsObj.conditions) {
                    termsRow(doc, 'Special Conditions', String(termsObj.conditions), { even: true });
                }
                if (txType === 'BUY' && termsObj.topUpPlan) {
                    termsRow(doc, 'Payment Plan', String(termsObj.topUpPlan), { even: false });
                }

                if (txType === 'EXCHANGE' && termsObj.exchange) {
                    doc.moveDown(0.5);
                    doc.font('Helvetica-Bold').fontSize(FONT.small).fillColor(C.muted)
                        .text('EXCHANGE DETAILS', { characterSpacing: 0.7 });
                    doc.moveDown(0.2);

                    const exRows = [
                        termsObj.exchange.payer         && { label: 'Paid by',      value: String(termsObj.exchange.payer) },
                        termsObj.exchange.topUpAmount != null && { label: 'Extra amount', value: String(termsObj.exchange.topUpAmount) },
                        termsObj.exchange.direction     && { label: 'Direction',    value: String(termsObj.exchange.direction) },
                    ].filter(Boolean);
                    exRows.forEach(({ label, value }, i) => termsRow(doc, label, value, { even: i % 2 === 0 }));

                    if (termsObj.exchange?.clientPhone?.fields && typeof termsObj.exchange.clientPhone.fields === 'object') {
                        doc.moveDown(0.4);
                        doc.font('Helvetica-Bold').fontSize(FONT.small).fillColor(C.muted)
                            .text('CLIENT TRADE-IN DEVICE', { characterSpacing: 0.7 });
                        doc.moveDown(0.2);
                        Object.entries(termsObj.exchange.clientPhone.fields).forEach(([k, v], i) => {
                            termsRow(doc, k, typeof v === 'object' ? JSON.stringify(v) : String(v ?? '-'), { even: i % 2 === 0 });
                        });
                    }

                    if (exchangeBufs?.filter(Boolean).length > 0) {
                        addImageGrid(doc, 'Trade-In Device Photos', exchangeBufs);
                    }
                }
            } else {
                doc.font('Times-Italic').fontSize(FONT.body).fillColor('#555')
                    .text(String(agreement.terms || 'No additional terms specified.'));
            }

            doc.moveDown(1.2);

            // ── SECTION 5: SIGNATURES ──────────────────────────────────────
            sectionTitle(doc, 5, 'Signatures & Acknowledgement');
            ensureSpace(doc, 130);

            const sigY       = doc.y + 8;
            const sigColW    = (bodyW - 32) / 2;
            const leftSigX   = PAGE_MARGIN;
            const rightSigX  = PAGE_MARGIN + sigColW + 32;

            function drawSigBlock(x, name, role) {
                // Dashed signing line
                doc.save()
                    .dash(4, { space: 3 })
                    .moveTo(x, sigY + 36).lineTo(x + sigColW, sigY + 36)
                    .lineWidth(0.8).strokeColor('#9ca3af').stroke()
                    .undash()
                    .restore();

                doc.font('Helvetica-Bold').fontSize(12).fillColor(C.text)
                    .text(name || '-', x, sigY + 44, { width: sigColW });
                doc.font('Helvetica').fontSize(FONT.body).fillColor(C.muted)
                    .text(role, x, sigY + 58, { width: sigColW });
                doc.font('Helvetica').fontSize(FONT.body).fillColor(C.muted)
                    .text('Date: _______________', x, sigY + 74, { width: sigColW });
            }

            drawSigBlock(leftSigX,  agreement.seller?.businessName || sellerUser?.fullName, 'Seller / Authorized Representative');
            drawSigBlock(rightSigX, buyerUser?.fullName, 'Buyer / Client');

            // Stamp circle (seller side)
            const stCX = leftSigX + sigColW - 36;
            const stCY = sigY + 60;
            doc.save()
                .circle(stCX, stCY, 30)
                .lineWidth(1.5).strokeColor(C.stampRing).stroke()
                .font('Helvetica-Bold').fontSize(FONT.tiny).fillColor(C.stampText)
                .text('Official\nStamp', stCX - 20, stCY - 9, { width: 40, align: 'center' })
                .restore();

            doc.y = sigY + 100;

            // ── FOOTER ────────────────────────────────────────────────────
            doc.moveDown(1.5);
            drawDivider(doc, { color: C.border });
            doc.moveDown(0.6);

            // Footer background
            const ftY = doc.y;
            const ftH = 36;
            doc.save()
                .rect(0, ftY, pageW, ftH + 12)
                .fillColor(C.surface).fill()
                .restore();

            doc.font('Helvetica').fontSize(FONT.tiny).fillColor(C.mutedLight)
                .text(
                    'This is a legally binding agreement between the parties identified above. Generated by the E-Nyandiko platform. Any disputes shall be resolved under applicable commercial law.',
                    PAGE_MARGIN, ftY + 6,
                    { width: bodyW - 80, align: 'left' }
                );

            doc.font('Helvetica').fontSize(FONT.tiny).fillColor(C.mutedLight)
                .text(String(agreement.id), pageW - PAGE_MARGIN - 80, ftY + 6, {
                    width: 80, align: 'right',
                });

            doc.end();
        });

        // ── Send response ────────────────────────────────────────────────────
        res.setHeader('Content-Type', 'application/pdf');
        const dl = String(req.query?.download || '').toLowerCase();
        const isDownload = dl === '1' || dl === 'true' || dl === 'yes';
        res.setHeader('Content-Disposition', `${isDownload ? 'attachment' : 'inline'}; filename="agreement-${agreement.id}.pdf"`);
        res.setHeader('Content-Length', pdfBuffer.length);
        res.end(pdfBuffer);

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