const sellerService = require('../services/seller.service');
const { ok } = require('../utils/response');

async function getProfile(req, res, next) {
    try {
        const userId = req.user.id;
        const seller = await sellerService.getSellerProfile(userId);
        return ok(res, { message: 'Seller profile', data: seller });
    } catch (err) {
        return next(err);
    }
}

async function updateProfile(req, res, next) {
    try {
        const userId = req.user.id;
        const updated = await sellerService.updateSellerProfile(userId, {
            ...req.body,
            file: req.file
        });
        return ok(res, { message: 'Profile updated', data: updated });
    } catch (err) {
        return next(err);
    }
}

async function getDashboardStats(req, res, next) {
    try {
        const userId = req.user.id;
        const stats = await sellerService.getSellerDashboardStats(userId);
        return ok(res, { message: 'Dashboard stats', data: stats });
    } catch (err) {
        return next(err);
    }
}

async function searchClients(req, res, next) {
    try {
        const userId = req.user.id;
        const query = req.query.q;
        const clients = await sellerService.searchClients(userId, query);
        return ok(res, { message: 'Clients found', data: clients });
    } catch (err) {
        return next(err);
    }
}

module.exports = {
    getProfile,
    updateProfile,
    getDashboardStats,
    searchClients
};

