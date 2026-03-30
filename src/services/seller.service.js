const env = require('../config/env');
const { ApiError } = require('../utils/errors');
const sellerRepository = require('../repositories/seller.repository');
const deviceRepository = require('../repositories/device.repository');
const agreementRepository = require('../repositories/agreement.repository');
const { uploadBuffer } = require('./imageUpload.service');


async function getSellerProfile(userId) {
    const seller = await sellerRepository.findSellerByUserId(userId);
    if (!seller) throw new ApiError(404, 'Seller profile not found');
    return seller;
}

async function updateSellerProfile(userId, data) {
    const seller = await sellerRepository.findSellerByUserId(userId);
    if (!seller) throw new ApiError(404, 'Seller profile not found');

    const updateData = {
        businessName: data.businessName,
        tinNumber: data.tinNumber,
        phone: data.phone,
        whatsapp: data.whatsapp,
        location: data.location,
        floor: data.floor
    };

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
    const seller = await sellerRepository.findSellerByUserId(userId);
    if (!seller) throw new ApiError(404, 'Seller profile not found');

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

    const seller = await sellerRepository.findSellerByUserId(userId);
    if (!seller) throw new ApiError(404, 'Seller profile not found');

    const users = await sellerRepository.searchClients(seller.id, query.trim());

    return users.map(u => {
        let photoUrl = null;
        let lastLocation = null;

        const latestAgreement = u.buyer?.agreementsAsBuyer?.[0];
        if (latestAgreement && latestAgreement.terms) {
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
            photoUrl,
            location: lastLocation
        };
    });
}

module.exports = {
    getSellerProfile,
    updateSellerProfile,
    getSellerDashboardStats,
    searchClients
};

