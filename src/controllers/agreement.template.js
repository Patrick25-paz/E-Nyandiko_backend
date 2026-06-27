const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer');

function normalizeCloudinaryImageUrl(url) {
  if (!url || typeof url !== 'string') return null;
  const value = url.trim();
  if (!/^https?:\/\//i.test(value)) return null;
  if (value.includes('res.cloudinary.com') && value.includes('/image/upload/')) {
    const [prefix, rest] = value.split('/image/upload/');
    if (!rest) return value;
    if (/^f_[^/]+\//.test(rest)) return value;
    return `${prefix}/image/upload/f_jpg/${rest}`;
  }
  return value;
}

function safeJsonParse(text) {
  if (!text || typeof text !== 'string') return null;
  try { return JSON.parse(text); } catch { return null; }
}

function safeString(value) {
  if (value === null || value === undefined) return '-';
  if (typeof value === 'string') return value;
  try { return JSON.stringify(value); } catch { return String(value); }
}

function escapeHtml(value = '') {
  return String(value).replace(/[&<>"']/g, (character) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  })[character]);
}

function fileToDataUrl(filePath) {
  try {
    if (!filePath || !fs.existsSync(filePath)) return null;
    const extension = path.extname(filePath).toLowerCase();
    const mime = {
      '.png': 'image/png',
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.webp': 'image/webp',
      '.gif': 'image/gif',
    }[extension] || 'application/octet-stream';
    const buffer = fs.readFileSync(filePath);
    if (!buffer.length) return null;
    return `data:${mime};base64,${buffer.toString('base64')}`;
  } catch {
    return null;
  }
}

function getPlatformLogoDataUrl() {
  const candidates = [
    path.resolve(__dirname, '../../../frontend/src/images/E-Nyandiko.png'),
    path.resolve(__dirname, '../../../frontend/src/images/enyandiko_logo.png'),
    path.resolve(__dirname, '../../../frontend/src/images/logo.png'),
  ];

  for (const candidate of candidates) {
    const dataUrl = fileToDataUrl(candidate);
    if (dataUrl) return dataUrl;
  }

  return null;
}

async function fetchImageAsDataUrl(url, { timeoutMs = 12000, maxBytes = 5 * 1024 * 1024 } = {}) {
  const normalized = normalizeCloudinaryImageUrl(url) || url;
  if (!normalized || !/^https?:\/\//i.test(String(normalized))) return null;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(normalized, {
      method: 'GET',
      headers: { Accept: 'image/*' },
      signal: controller.signal,
    });

    if (!response.ok) return null;

    const contentType = String(response.headers.get('content-type') || '').toLowerCase();
    if (!contentType.startsWith('image/') || contentType.includes('svg')) return null;

    const buffer = Buffer.from(await response.arrayBuffer());
    if (buffer.length === 0 || buffer.length > maxBytes) return null;

    return `data:${contentType};base64,${buffer.toString('base64')}`;
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

function renderImage(src, alt, { width = 72, height = 88, cover = true, radius = 4 } = {}) {
  if (!src) return '';
  const objectFit = cover ? 'cover' : 'contain';
  return `<img src="${escapeHtml(src)}" alt="${escapeHtml(alt)}" crossOrigin="anonymous" referrerPolicy="no-referrer" style="width:${width}px;height:${height}px;object-fit:${objectFit};border-radius:${radius}px;border:0.5px solid #d8d5cc;display:block;" />`;
}

function renderPhotoPlaceholder(label) {
  return `
    <div style="width:72px;height:88px;background:#f0efe9;border:0.5px solid #d8d5cc;border-radius:4px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:4px;margin-top:10px;">
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#999" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
        <rect x="3" y="3" width="18" height="18" rx="2"></rect>
        <circle cx="8.5" cy="8.5" r="1.5"></circle>
        <polyline points="21 15 16 10 5 21"></polyline>
      </svg>
      <span style="font-size:9px;color:#999;text-align:center;line-height:1.2;">${escapeHtml(label)}</span>
    </div>
  `;
}

function renderSection(number, title) {
  return `
    <div style="display:flex;align-items:center;gap:10px;margin-bottom:14px;padding-bottom:8px;border-bottom:0.5px solid #e0ddd6;page-break-after:avoid;">
      <div style="width:24px;height:24px;min-width:24px;background:#0f2444;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:500;color:#c9a227;">${escapeHtml(number)}</div>
      <div style="font-size:11px;font-weight:600;color:#0f2444;text-transform:uppercase;letter-spacing:0.08em;">${escapeHtml(title)}</div>
    </div>
  `;
}

function renderTermRow(label, value, { highlight = false } = {}) {
  return `
    <div style="display:grid;grid-template-columns:160px 1fr;gap:12px;padding:9px 16px;border-bottom:0.5px solid #e0ddd6;font-size:11px;align-items:center;background:${highlight ? '#fafaf8' : 'transparent'};page-break-inside:avoid;">
      <div style="color:#666;font-weight:400;">${escapeHtml(label)}</div>
      <div style="color:#1a1a1a;font-weight:500;word-break:break-word;">${escapeHtml(value)}</div>
    </div>
  `;
}

function renderImageGrid(title, urls) {
  const list = (urls || []).filter(Boolean).slice(0, 6);
  if (list.length === 0) return '';

  return `
    <div style="margin-top:12px;page-break-inside:avoid;">
      <div style="font-size:10px;font-weight:600;color:#555;margin-bottom:8px;text-transform:uppercase;letter-spacing:0.06em;">${escapeHtml(title)}</div>
      <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;">
        ${list.map((url, index) => `
          <img src="${escapeHtml(url)}" alt="${escapeHtml(`${title} ${index + 1}`)}" crossOrigin="anonymous" referrerPolicy="no-referrer" style="width:100%;height:90px;object-fit:cover;border-radius:4px;border:0.5px solid #d8d5cc;display:block;" />
        `).join('')}
      </div>
    </div>
  `;
}

function renderTermsSection(agreement, termsObj) {
  if (!termsObj) {
    return `
      <div style="font-size:11px;color:#555;font-style:italic;padding:10px 0;">
        ${escapeHtml(String(agreement.terms || 'No additional terms specified.'))}
      </div>
    `;
  }

  let html = `<div style="border:0.5px solid #d8d5cc;border-radius:8px;overflow:hidden;">`;
  html += renderTermRow('Transaction Type', safeString(termsObj.transactionType), { highlight: true });

  if (termsObj.price?.amount !== undefined && termsObj.price?.amount !== null && termsObj.price?.amount !== '') {
    html += renderTermRow('Amount (terms)', `${safeString(termsObj.price.amount)} ${safeString(termsObj.price.currency || agreement.currency)}`);
  }

  if (termsObj.warranty) {
    html += renderTermRow('Warranty Period', `${safeString(termsObj.warranty.months || '-') } months`, { highlight: true });
    if (termsObj.warranty.details) {
      html += renderTermRow('Warranty Details', safeString(termsObj.warranty.details));
    }
  }

  if (termsObj.conditions) {
    html += renderTermRow('Special Conditions', safeString(termsObj.conditions), { highlight: true });
  }

  if (termsObj.transactionType === 'BUY' && termsObj.topUpPlan) {
    html += renderTermRow('Payment methods and other additional information', safeString(termsObj.topUpPlan));
  }

  if (termsObj.transactionType === 'EXCHANGE' && termsObj.exchange) {
    html += `
      <div style="padding:10px 16px 6px;background:#f5f3ee;border-top:0.5px solid #d8d5cc;page-break-inside:avoid;">
        <div style="font-size:10px;font-weight:600;color:#555;text-transform:uppercase;letter-spacing:0.06em;">Exchange Details</div>
      </div>
    `;

    if (termsObj.exchange.payer) {
      html += renderTermRow('Paid by', safeString(termsObj.exchange.payer), { highlight: true });
    }
    if (termsObj.exchange.topUpAmount !== undefined) {
      html += renderTermRow('Extra amount', safeString(termsObj.exchange.topUpAmount));
    }
    if (termsObj.exchange.direction) {
      html += renderTermRow('Direction', safeString(termsObj.exchange.direction), { highlight: true });
    }

    if (termsObj.exchange.clientPhone?.fields && typeof termsObj.exchange.clientPhone.fields === 'object') {
      html += `
        <div style="padding:10px 16px 6px;background:#f5f3ee;border-top:0.5px solid #d8d5cc;page-break-inside:avoid;">
          <div style="font-size:10px;font-weight:600;color:#555;text-transform:uppercase;letter-spacing:0.06em;">Client Trade-In Device</div>
        </div>
      `;

      html += Object.entries(termsObj.exchange.clientPhone.fields)
        .map(([key, value], index) => renderTermRow(key, safeString(value), { highlight: index % 2 === 0 }))
        .join('');
    }
  }

  html += `</div>`;
  return html;
}

function buildHtml(agreement, assets) {
  const { sellerLogo, buyerPhoto, deviceImages = [], exchangeImages = [], platformLogo } = assets || {};
  const termsObj = safeJsonParse(agreement.terms);
  const device = agreement.deviceDetails || agreement.device || {};
  const deviceTypeName = device?.deviceType?.name || 'Device';
  const deviceTitle = device?.title ? ` — ${escapeHtml(device.title)}` : '';
  const transactionType = termsObj?.transactionType || '-';
  const docTitle = `Agreement for ${escapeHtml(deviceTypeName)}${deviceTitle}`;
  const statusColor = agreement.status === 'ACCEPTED' || agreement.status === 'COMPLETED'
    ? { bg: '#eaf3de', border: '#97c459', text: '#3b6d11', dot: '#639922' }
    : { bg: '#faeeda', border: '#efaa27', text: '#854f0b', dot: '#ba7517' };

  const sellerName = agreement.seller?.businessName || '-';
  const sellerUser = agreement.seller?.user || null;
  const buyerUser = agreement.buyer?.user || null;
  const locale = 'en-US';
  const createdAt = agreement.createdAt ? new Date(agreement.createdAt).toLocaleString(locale) : '-';
  const acceptedAt = agreement.acceptedAt ? new Date(agreement.acceptedAt).toLocaleString(locale) : '-';
  const sellerLogoHtml = sellerLogo
    ? renderImage(sellerLogo, 'Seller Logo', { width: 72, height: 88, cover: true })
    : renderPhotoPlaceholder('Seller logo');
  const buyerPhotoHtml = buyerPhoto
    ? renderImage(buyerPhoto, 'Buyer', { width: 72, height: 88, cover: true })
    : renderPhotoPlaceholder('Buyer photo');

  const sellerFields = [
    ['TIN', agreement.seller?.tinNumber],
    ['Contact', sellerUser?.fullName],
    ['Email', sellerUser?.email],
    ['Phone', agreement.seller?.phone || sellerUser?.phone],
    ['WhatsApp', agreement.seller?.whatsapp],
    ['Location', agreement.seller?.location],
    ['Floor', agreement.seller?.floor],
  ].filter(([, value]) => value);

  const buyerFields = [
    ['Email', buyerUser?.email],
    ['National ID', buyerUser?.nationalId],
    ['Client code', buyerUser?.clientCode],
    ['Location', termsObj?.client?.location],
  ].filter(([, value]) => value);

  const deviceFieldRows = Array.isArray(device?.fieldValues)
    ? device.fieldValues.map((fieldValue, index) => {
        const label = fieldValue?.deviceField?.label || fieldValue?.deviceField?.key || 'Field';
        const value = typeof fieldValue?.value === 'object' ? JSON.stringify(fieldValue.value) : String(fieldValue?.value ?? '-');
        return renderTermRow(label, value, { highlight: index % 2 === 0 });
      }).join('')
    : '';

  const deviceImageSources = deviceImages.filter(Boolean);
  const exchangeImageSources = exchangeImages.filter(Boolean);

  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <style>
    @page { size: A4; margin: 0; }
    html, body { margin: 0; padding: 0; background: #ffffff; color: #1a1a1a; }
    body { font-family: 'DM Sans', 'Segoe UI', sans-serif; }
    .sheet { width: 100%; box-sizing: border-box; }
    .header { background: #ffffff; border-bottom: 0.5px solid #e0ddd6; padding: 28px 36px 22px; position: relative; color: #1a1a1a; }
    .header:after { content: ''; position: absolute; left: 0; right: 0; bottom: 0; height: 3px; background: linear-gradient(90deg, #c9a227 0%, #e6c35a 50%, #c9a227 100%); }
    .header-top { display: flex; justify-content: space-between; align-items: flex-start; gap: 18px; margin-bottom: 18px; }
      .brand { display: flex; align-items: center; gap: 16px; }
      .brand-logo { width: 72px; height: 72px; object-fit: contain; display: block; }
      .brand-title { font-size: 18px; font-weight: 800; color: #0f2444; letter-spacing: 0.12em; text-transform: uppercase; line-height: 1.05; }
      .brand-subtitle { font-size: 12px; color: #374151; margin-top: 3px; font-weight: 600; }
    .status-block { display: flex; flex-direction: column; align-items: flex-end; gap: 6px; }
    .type-pill { background: rgba(201,162,39,0.15); border: 0.5px solid rgba(201,162,39,0.4); border-radius: 4px; padding: 3px 10px; font-size: 10px; font-weight: 600; color: #854f0b; letter-spacing: 0.06em; }
    .status-pill { display: inline-flex; align-items: center; gap: 5px; border-radius: 999px; padding: 3px 10px; font-size: 10px; font-weight: 500; border: 0.5px solid ${statusColor.border}; color: ${statusColor.text}; background: ${statusColor.bg}; }
    .status-dot { width: 6px; height: 6px; background: ${statusColor.dot}; border-radius: 50%; display: inline-block; }
    .doc-title { font-family: Georgia, 'Times New Roman', serif; font-size: 22px; font-weight: 400; color: #0f2444; line-height: 1.25; margin-bottom: 4px; }
    .meta-row { display: grid; grid-template-columns: repeat(3, 1fr); gap: 14px; margin-top: 18px; padding-top: 16px; border-top: 0.5px solid #e0ddd6; }
    .meta-label { font-size: 9px; color: #9ca3af; text-transform: uppercase; letter-spacing: 0.06em; margin-bottom: 3px; }
    .meta-value { font-size: 11px; color: #1a1a1a; font-weight: 500; word-break: break-word; }
    .body { padding: 28px 36px; position: relative; overflow: hidden; }
    .watermark { position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%) rotate(-30deg); font-family: Georgia, serif; font-size: 72px; font-weight: 700; color: rgba(15,36,68,0.04); pointer-events: none; white-space: nowrap; z-index: 0; }
    .recital { background: #fafaf8; border-left: 3px solid #c9a227; padding: 12px 16px; border-radius: 0 6px 6px 0; margin-bottom: 26px; position: relative; z-index: 1; }
    .recital p { font-family: Georgia, 'Times New Roman', serif; font-size: 12px; color: #444; line-height: 1.75; font-style: italic; margin: 0; }
    .recital strong { font-style: normal; color: #1a1a1a; }
    .section { margin-bottom: 26px; position: relative; z-index: 1; }
    .cards { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
    .card { background: #fafaf8; border: 0.5px solid #d8d5cc; border-radius: 8px; overflow: hidden; page-break-inside: avoid; }
    .card-accent-navy { height: 3px; background: #0f2444; }
    .card-accent-gold { height: 3px; background: #c9a227; }
    .card-body { padding: 14px 16px; }
    .card-label { font-size: 9px; font-weight: 600; color: #888; text-transform: uppercase; letter-spacing: 0.08em; margin-bottom: 8px; }
    .card-name { font-family: Georgia, serif; font-size: 15px; font-weight: 400; color: #1a1a1a; margin-bottom: 10px; line-height: 1.2; word-break: break-word; }
    .detail-list { margin-top: 10px; display: flex; flex-direction: column; gap: 5px; }
    .detail-row { display: grid; grid-template-columns: 72px 1fr; gap: 6px; font-size: 11px; }
    .detail-row span:first-child { color: #888; }
    .detail-row span:last-child { color: #1a1a1a; font-weight: 500; word-break: break-word; }
    .table { border: 0.5px solid #d8d5cc; border-radius: 8px; overflow: hidden; }
    .amount-row { display: grid; grid-template-columns: 160px 1fr; gap: 12px; padding: 12px 16px; border-bottom: 0.5px solid #d8d5cc; align-items: center; background: #fafaf8; }
    .amount-label { font-size: 11px; color: #666; }
    .amount-value { font-family: Georgia, serif; font-size: 20px; font-weight: 400; color: #0f2444; }
    .amount-currency { font-size: 12px; color: #888; }
    .terms-raw { font-size: 11px; color: #555; font-style: italic; padding: 10px 0; }
    .signature-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 32px; margin-top: 8px; }
    .signature-line { height: 48px; border-bottom: 0.5px dashed #aaa; margin-bottom: 10px; }
    .signature-name { font-size: 12px; font-weight: 500; color: #1a1a1a; word-break: break-word; }
    .signature-role { font-size: 10px; color: #888; margin-top: 2px; }
    .signature-date { font-size: 10px; color: #888; margin-top: 8px; }
    .stamp { width: 64px; height: 64px; border: 1.5px solid rgba(15,36,68,0.18); border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 8px; font-weight: 500; color: rgba(15,36,68,0.25); text-transform: uppercase; letter-spacing: 0.04em; text-align: center; line-height: 1.4; margin-top: 12px; }
    .footer { background: #fafaf8; border-top: 0.5px solid #e0ddd6; padding: 14px 36px; display: flex; justify-content: space-between; align-items: center; gap: 16px; }
    .footer-note { font-size: 9px; color: #999; line-height: 1.6; max-width: 420px; }
    .footer-meta { font-size: 9px; color: #bbb; text-align: right; font-family: monospace; white-space: nowrap; }
    .page-break { page-break-after: always; }
    .avoid-break { page-break-inside: avoid; }
    .image-title { font-size: 10px; font-weight: 600; color: #555; margin-bottom: 8px; text-transform: uppercase; letter-spacing: 0.06em; }
  </style>
</head>
<body>
  <div class="sheet">
    <div class="header">
      <div class="header-top">
        <div class="brand">
          ${platformLogo ? `<img class="brand-logo" src="${escapeHtml(platformLogo)}" alt="E-Nyandiko" />` : ''}
          <div>
            <div class="brand-title">E-Nyandiko</div>
            <div class="brand-subtitle">Official Agreement Document</div>
          </div>
        </div>
        <div class="status-block">
          <div class="type-pill">${escapeHtml(transactionType === 'EXCHANGE' ? 'EXCHANGE AGREEMENT' : 'SALE AGREEMENT')}</div>
          <div class="status-pill"><span class="status-dot"></span><span>${escapeHtml(agreement.status || '-')}</span></div>
        </div>
      </div>

      <div class="doc-title">${docTitle}</div>

      <div class="meta-row">
        <div><div class="meta-label">Agreement ID</div><div class="meta-value">${escapeHtml(agreement.id)}</div></div>
        <div><div class="meta-label">Date Created</div><div class="meta-value">${escapeHtml(createdAt)}</div></div>
        <div><div class="meta-label">Date Confirmed</div><div class="meta-value">${escapeHtml(acceptedAt)}</div></div>
      </div>
    </div>

    <div class="body">
      <div class="watermark">E-NYANDIKO</div>

      <div class="recital">
        <p>
          This agreement is entered into between the <strong>Seller</strong> and <strong>Buyer</strong> identified herein, and constitutes a legally binding contract for the device described below.
          Transaction type: <strong>${escapeHtml(transactionType)}</strong>.
        </p>
      </div>

      <div class="section">
        ${renderSection('1', 'Parties to the Agreement')}
        <div class="cards">
          <div class="card">
            <div class="card-accent-navy"></div>
            <div class="card-body">
              <div class="card-label">Seller / Vendor</div>
              <div class="card-name">${escapeHtml(sellerName)}</div>
              ${sellerLogoHtml}
              <div class="detail-list">
                ${sellerFields.map(([label, value]) => `<div class="detail-row"><span>${escapeHtml(label)}</span><span>${escapeHtml(safeString(value))}</span></div>`).join('')}
              </div>
            </div>
          </div>

          <div class="card">
            <div class="card-accent-gold"></div>
            <div class="card-body">
              <div class="card-label">Buyer / Client</div>
              <div class="card-name">${escapeHtml(buyerUser?.fullName || '-')}</div>
              ${buyerPhotoHtml}
              <div class="detail-list">
                ${buyerFields.map(([label, value]) => `<div class="detail-row"><span>${escapeHtml(label)}</span><span>${escapeHtml(safeString(value))}</span></div>`).join('')}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div class="section">
        ${renderSection('2', 'Device Information')}
        <div class="table">
          <div class="amount-row"><div class="amount-label">Type</div><div class="amount-value" style="font-size:11px;">${escapeHtml(deviceTypeName)}</div></div>
          <div class="amount-row" style="background:#fff;"><div class="amount-label">Title / Model</div><div style="font-size:11px;color:#1a1a1a;font-weight:500;">${escapeHtml(device?.title || 'N/A')}</div></div>
          ${deviceFieldRows}
        </div>
        ${renderImageGrid('Device Photos', deviceImageSources)}
      </div>

      <div class="section">
        ${renderSection('3', 'Financial Terms')}
        <div class="table">
          <div class="amount-row">
            <div class="amount-label">Total Amount</div>
            <div><span class="amount-value">${escapeHtml(safeString(agreement.price))}</span> <span class="amount-currency">${escapeHtml(safeString(agreement.currency))}</span></div>
          </div>
          ${renderTermRow('Date Created', createdAt)}
          ${renderTermRow('Date Confirmed', acceptedAt, { highlight: true })}
        </div>
      </div>

      <div class="section">
        ${renderSection('4', 'Terms & Conditions')}
        ${renderTermsSection(agreement, termsObj)}
        ${renderImageGrid('Trade-In Device Photos', exchangeImageSources)}
      </div>

      <div class="section" style="margin-bottom:10px;">
        ${renderSection('5', 'Signatures & Acknowledgement')}
        <div class="signature-grid">
          <div>
            <div class="signature-line"></div>
            <div class="signature-name">${escapeHtml(agreement.seller?.businessName || sellerUser?.fullName || '-')}</div>
            <div class="signature-role">Seller / Authorized Representative</div>
            <div class="signature-date">Date: ${agreement.acceptedAt ? escapeHtml(acceptedAt) : '_______________'}</div>
            <div class="stamp">Official<br/>Stamp</div>
          </div>

          <div>
            <div class="signature-line"></div>
            <div class="signature-name">${escapeHtml(buyerUser?.fullName || '-')}</div>
            <div class="signature-role">Buyer / Client</div>
            <div class="signature-date">Date: ${agreement.acceptedAt ? escapeHtml(acceptedAt) : '_______________'}</div>
          </div>
        </div>
      </div>
    </div>

    <div class="footer">
      <div class="footer-note">This is a legally binding agreement between the parties identified above. Generated by the E-Nyandiko platform. Any disputes shall be resolved under applicable commercial law.</div>
      <div class="footer-meta">${escapeHtml(agreement.id)}</div>
    </div>
  </div>
</body>
</html>`;
}

async function renderAgreementPdf(agreement, { puppeteerLaunchOptions = {} } = {}) {
  const sellerLogoUrl = agreement.seller?.logoUrl ? await fetchImageAsDataUrl(agreement.seller.logoUrl).catch(() => null) : null;

  let buyerPhotoUrl = null;
  try {
    buyerPhotoUrl = agreement?.terms ? safeJsonParse(agreement.terms)?.client?.photo?.url || null : null;
  } catch {
    buyerPhotoUrl = null;
  }

  const termsObj = safeJsonParse(agreement.terms);
  const deviceImageUrls = (agreement.deviceDetails?.images || agreement.device?.images || [])
    .map((image) => image?.url || image)
    .filter(Boolean)
    .slice(0, 6);
  const exchangeImageUrls = (termsObj?.exchange?.clientPhone?.images || [])
    .map((image) => image?.url || image)
    .filter(Boolean)
    .slice(0, 6);

  const [deviceImages, exchangeImages] = await Promise.all([
    Promise.all(deviceImageUrls.map((url) => fetchImageAsDataUrl(url).catch(() => null))),
    Promise.all(exchangeImageUrls.map((url) => fetchImageAsDataUrl(url).catch(() => null))),
  ]);

  const html = buildHtml(agreement, {
    platformLogo: getPlatformLogoDataUrl(),
    sellerLogo: sellerLogoUrl,
    buyerPhoto: buyerPhotoUrl ? await fetchImageAsDataUrl(buyerPhotoUrl).catch(() => null) : null,
    deviceImages: deviceImages.filter(Boolean),
    exchangeImages: exchangeImages.filter(Boolean),
  });

  const executablePath = (() => {
    const candidates = [
      process.env.PUPPETEER_EXECUTABLE_PATH,
      process.env.CHROME_PATH,
      process.env.EDGE_PATH,
      'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
      'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
      'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
      'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
      process.env.LOCALAPPDATA ? path.join(process.env.LOCALAPPDATA, 'Google\\Chrome\\Application\\chrome.exe') : null,
      process.env.USERPROFILE ? path.join(process.env.USERPROFILE, 'AppData\\Local\\Google\\Chrome\\Application\\chrome.exe') : null,
      process.env.LOCALAPPDATA ? path.join(process.env.LOCALAPPDATA, 'Microsoft\\Edge\\Application\\msedge.exe') : null,
    ].filter(Boolean);

    for (const candidate of candidates) {
      try {
        if (fs.existsSync(candidate)) return candidate;
      } catch {
        // ignore invalid candidates
      }
    }

    return null;
  })();

  const browser = await puppeteer.launch({
    executablePath: executablePath || undefined,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
    ...puppeteerLaunchOptions,
  });

  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'networkidle0' });
    const pdfBuffer = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: { top: '0mm', right: '0mm', bottom: '0mm', left: '0mm' },
    });
    await page.close();
    return pdfBuffer;
  } finally {
    await browser.close();
  }
}

module.exports = { renderAgreementPdf };