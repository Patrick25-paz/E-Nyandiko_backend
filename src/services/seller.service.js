const env = require('../config/env');
const { ApiError } = require('../utils/errors');
const sellerRepository = require('../repositories/seller.repository');
const deviceRepository = require('../repositories/device.repository');
const agreementRepository = require('../repositories/agreement.repository');
const authRepository = require('../repositories/auth.repository');
const { uploadBuffer } = require('./imageUpload.service');


function formatSellerLocationFromParts(data) {
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
    return (base || extra) ? `${base}${extra}`.trim() : null;
}

async function ensureSellerProfile(userId) {
    const user = await authRepository.findUserById(userId);
    if (!user) throw new ApiError(404, 'User not found');
    if (!['SHOP', 'INDIVIDUAL'].includes(user.type)) {
        throw new ApiError(403, 'Seller profile not available for this account');
    }

    let seller = await sellerRepository.findSellerByUserId(userId);
    if (!seller) {
        await authRepository.createSellerProfile(userId);
        seller = await sellerRepository.findSellerByUserId(userId);
    }

    if (!seller) throw new ApiError(404, 'Seller profile not found');
    return seller;
}

async function getSellerProfile(userId) {
    return ensureSellerProfile(userId);
}

async function updateSellerProfile(userId, data) {
    const seller = await ensureSellerProfile(userId);

    const updateData = {
        businessName: data.businessName,
        tinNumber: data.tinNumber,
        phone: data.phone,
        whatsapp: data.whatsapp,
        location: data.location,
        province: data.province,
        district: data.district,
        sector: data.sector,
        cell: data.cell,
        village: data.village,
        noticeableName: data.noticeableName,
        houseName: data.houseName,
        floor: data.floor
    };

    // If structured fields are provided (and legacy location isn't), keep `location` in sync for older views.
    const hasStructured = Boolean(
        data.province || data.district || data.sector || data.cell || data.village || data.noticeableName || data.houseName || data.floor
    );
    if (!data.location && hasStructured) {
        const formatted = formatSellerLocationFromParts(data);
        if (formatted) updateData.location = formatted;
    }

    if (data.file) {
        const folder = `${env.CLOUDINARY_FOLDER}/sellers/${seller.id}`;
        const result = await uploadBuffer({
            buffer: data.file.buffer,
            folder,
            filename: `logo_${Date.now()}`
        });

        updateData.logoUrl = result.secure_url;
        updateData.logoPublicId = result.public_id;
    }

    return sellerRepository.updateSellerProfile(userId, updateData);
}

async function getSellerDashboardStats(userId) {
    const seller = await ensureSellerProfile(userId);

    const [deviceStats, agreementStats] = await Promise.all([
        deviceRepository.getStatsForSeller(seller.id),
        agreementRepository.getStatsForSeller(seller.id)
    ]);

    return {
        devices: deviceStats,
        agreements: agreementStats
    };
}

async function searchClients(userId, query) {
    if (!query || query.trim().length === 0) return [];

    const seller = await ensureSellerProfile(userId);

    const users = await sellerRepository.searchClients(seller.id, query.trim());

    return users.map(u => {
        let photoUrl = u.profileImageUrl || null;
        let lastLocation = null;
        const profileLocation = u.location || formatSellerLocationFromParts(u) || null;

        const latestAgreement = u.buyer?.agreementsAsBuyer?.[0];
        if (!photoUrl && latestAgreement && latestAgreement.terms) {
            try {
                const termsObj = JSON.parse(latestAgreement.terms);
                if (termsObj?.client?.photo?.url) {
                    photoUrl = termsObj.client.photo.url;
                }
                if (termsObj?.client?.location) {
                    lastLocation = termsObj.client.location;
                }
            } catch (e) {
                // Ignore parse errors safely
            }
        }

        return {
            id: u.id,
            fullName: u.fullName,
            email: u.email,
            nationalId: u.nationalId,
            clientCode: u.clientCode,
            phone: u.phone,
            profileImageUrl: u.profileImageUrl || null,
            photoUrl,
            location: profileLocation || lastLocation
        };
    });
}

async function searchShops(userId, query) {
    if (!query || query.trim().length === 0) return [];

    await ensureSellerProfile(userId);

    const shops = await sellerRepository.searchShops(query.trim());

    return shops.map((shop) => ({
        id: shop.id,
        businessName: shop.businessName,
        phone: shop.phone,
        whatsapp: shop.whatsapp,
        location: shop.location || formatSellerLocationFromParts(shop),
        logoUrl: shop.logoUrl,
        user: {
            id: shop.user?.id,
            email: shop.user?.email,
            fullName: shop.user?.fullName,
            type: shop.user?.type
        }
    }));
}

module.exports = {
    getSellerProfile,
    updateSellerProfile,
    getSellerDashboardStats,
    searchClients,
    searchShops
};

