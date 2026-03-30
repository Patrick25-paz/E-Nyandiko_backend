const subscriptionService = require('../services/subscription.service');
const { ok, created } = require('../utils/response');

async function getSettings(req, res, next) {
    try {
        const settings = await subscriptionService.getSettings();
        return ok(res, { message: 'Subscription settings', data: settings });
    } catch (err) {
        return next(err);
    }
}

async function updateSettings(req, res, next) {
    try {
        const settings = await subscriptionService.updateSettings(req.user, req.body);
        return ok(res, { message: 'Subscription settings updated', data: settings });
    } catch (err) {
        return next(err);
    }
}

async function getMySubscription(req, res, next) {
    try {
        const data = await subscriptionService.getMySubscriptionOverview(req.user);
        return ok(res, { message: 'My subscription', data });
    } catch (err) {
        return next(err);
    }
}

async function createMyClaim(req, res, next) {
    try {
        const claim = await subscriptionService.createMyClaim(req.user);
        return created(res, { message: 'Subscription claimed', data: claim });
    } catch (err) {
        return next(err);
    }
}

async function listAdminSellers(req, res, next) {
    try {
        const rows = await subscriptionService.listAdminSellers(req.user);
        return ok(res, { message: 'Sellers subscriptions', data: rows });
    } catch (err) {
        return next(err);
    }
}

async function adminDeleteSeller(req, res, next) {
    try {
        const result = await subscriptionService.adminDeleteUnverifiedSeller(req.user, req.params.sellerId);
        return ok(res, { message: 'Seller deleted', data: result });
    } catch (err) {
        return next(err);
    }
}

async function listClaims(req, res, next) {
    try {
        const rows = await subscriptionService.listClaims(req.user, req.query);
        return ok(res, { message: 'Subscription claims', data: rows });
    } catch (err) {
        return next(err);
    }
}

async function approveClaim(req, res, next) {
    try {
        const result = await subscriptionService.approveClaim(req.user, req.params.id);
        return ok(res, { message: 'Claim approved', data: result });
    } catch (err) {
        return next(err);
    }
}

async function rejectClaim(req, res, next) {
    try {
        const claim = await subscriptionService.rejectClaim(req.user, req.params.id);
        return ok(res, { message: 'Claim rejected', data: claim });
    } catch (err) {
        return next(err);
    }
}

async function report(req, res, next) {
    try {
        const data = await subscriptionService.getReport(req.user, req.query);
        return ok(res, { message: 'Subscription report', data });
    } catch (err) {
        return next(err);
    }
}

module.exports = {
    getSettings,
    updateSettings,
    getMySubscription,
    createMyClaim,
    listAdminSellers,
    adminDeleteSeller,
    listClaims,
    approveClaim,
    rejectClaim,
    report
};
