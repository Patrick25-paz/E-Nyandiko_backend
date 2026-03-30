const { ApiError } = require('../utils/errors');
const subscriptionRepository = require('../repositories/subscription.repository');

function addDays(date, days) {
    const d = new Date(date);
    d.setDate(d.getDate() + days);
    return d;
}

function getYmdInTimeZone(date, timeZone) {
    const parts = new Intl.DateTimeFormat('en-CA', {
        timeZone,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
    }).formatToParts(date);

    const out = { year: 0, month: 0, day: 0 };
    for (const p of parts) {
        if (p.type === 'year') out.year = Number(p.value);
        if (p.type === 'month') out.month = Number(p.value);
        if (p.type === 'day') out.day = Number(p.value);
    }
    return out;
}

function endOfDayKigali(date) {
    // Africa/Kigali is UTC+02 with no DST. Represent 23:59:59 Kigali as 21:59:59 UTC.
    const { year, month, day } = getYmdInTimeZone(date, 'Africa/Kigali');
    return new Date(Date.UTC(year, month - 1, day, 21, 59, 59, 0));
}

function startOfMonthUtc(year, month1to12) {
    return new Date(Date.UTC(year, month1to12 - 1, 1, 0, 0, 0, 0));
}

function startOfNextMonthUtc(year, month1to12) {
    return new Date(Date.UTC(year, month1to12, 1, 0, 0, 0, 0));
}

async function getSettings() {
    return subscriptionRepository.getOrCreateSettings();
}

async function updateSettings(user, { monthlyFee, currency, paymentNumber, whatsappNumber, receiverNames }) {
    if (!user?.roles?.includes('ADMIN')) throw new ApiError(403, 'Forbidden');
    return subscriptionRepository.updateSettings({ monthlyFee, currency, paymentNumber, whatsappNumber, receiverNames });
}

async function getMySubscriptionOverview(user) {
    if (!user?.sellerId) throw new ApiError(403, 'Seller profile required');

    const now = new Date();
    const [settings, active, latest, pendingClaim] = await Promise.all([
        subscriptionRepository.getOrCreateSettings(),
        subscriptionRepository.findActiveSubscriptionBySellerId(user.sellerId, now),
        subscriptionRepository.findLatestSubscriptionBySellerId(user.sellerId),
        subscriptionRepository.findPendingClaimBySellerId(user.sellerId)
    ]);

    // If latest subscription is marked ACTIVE but already ended, mark it EXPIRED.
    if (latest && latest.status === 'ACTIVE' && latest.endAt && new Date(latest.endAt) <= now) {
        await subscriptionRepository.expireSubscription(latest.id);
    }

    const activeSubscription = active || null;

    return {
        settings: {
            monthlyFee: settings.monthlyFee,
            currency: settings.currency,
            paymentNumber: settings.paymentNumber,
            whatsappNumber: settings.whatsappNumber,
            receiverNames: settings.receiverNames
        },
        activeSubscription,
        latestSubscription: latest || null,
        pendingClaim: pendingClaim || null
    };
}

async function createMyClaim(user) {
    if (!user?.sellerId) throw new ApiError(403, 'Seller profile required');

    const now = new Date();
    const [settings, activeSubscription, pending] = await Promise.all([
        subscriptionRepository.getOrCreateSettings(),
        subscriptionRepository.findActiveSubscriptionBySellerId(user.sellerId, now),
        subscriptionRepository.findPendingClaimBySellerId(user.sellerId)
    ]);

    if (activeSubscription) {
        throw new ApiError(409, 'You already have an active subscription');
    }

    if (pending) {
        return pending;
    }

    return subscriptionRepository.createClaim({
        sellerId: user.sellerId,
        amount: settings.monthlyFee,
        currency: settings.currency
    });
}

async function listAdminSellers(user) {
    if (!user?.roles?.includes('ADMIN')) throw new ApiError(403, 'Forbidden');

    const now = new Date();
    const sellers = await subscriptionRepository.listSellersWithLatestSubscription();

    return sellers.map((s) => {
        const latest = s.subscriptions?.[0] || null;
        const pendingClaim = s.subscriptionClaims?.[0] || null;

        const isActive = Boolean(latest && latest.status === 'ACTIVE' && new Date(latest.endAt) > now);
        const status = isActive ? 'ACTIVE' : (latest ? 'EXPIRED' : 'NONE');

        return {
            sellerId: s.id,
            userId: s.userId,
            emailVerified: Boolean(s.user?.emailVerified),
            fullName: s.user?.fullName || '-',
            email: s.user?.email || '-',
            phone: s.phone || s.user?.phone || '-',
            location: s.location || '-',
            status,
            subscription: latest,
            pendingClaim
        };
    });
}

async function adminDeleteUnverifiedSeller(user, sellerId) {
    if (!user?.roles?.includes('ADMIN')) throw new ApiError(403, 'Forbidden');

    const seller = await subscriptionRepository.getSellerForAdminDelete(sellerId);
    if (!seller) throw new ApiError(404, 'Seller not found');

    if (seller.user?.emailVerified) {
        throw new ApiError(409, 'Cannot delete: email already verified');
    }

    const counts = seller._count || {};
    const hasData = (counts.devices || 0) > 0 || (counts.subscriptions || 0) > 0 || (counts.subscriptionClaims || 0) > 0 || (counts.agreementsAsSeller || 0) > 0;
    if (hasData) {
        throw new ApiError(409, 'Cannot delete: seller already has related records');
    }

    // Deleting the user cascades to Seller via onDelete: Cascade.
    return subscriptionRepository.deleteUserById(seller.userId);
}

async function listClaims(user, { status }) {
    if (!user?.roles?.includes('ADMIN')) throw new ApiError(403, 'Forbidden');
    return subscriptionRepository.listClaims({ status });
}

async function approveClaim(user, claimId) {
    if (!user?.roles?.includes('ADMIN')) throw new ApiError(403, 'Forbidden');

    const claim = await subscriptionRepository.getClaimById(claimId);
    if (!claim) throw new ApiError(404, 'Claim not found');
    if (claim.status !== 'CLAIMED') throw new ApiError(409, 'Claim is already reviewed');

    const startAt = new Date();
    const endAt = endOfDayKigali(addDays(startAt, 30));

    const result = await subscriptionRepository.approveClaim({
        claimId,
        reviewedByUserId: user.id,
        startAt,
        endAt
    });

    if (!result?.subscription) throw new ApiError(500, 'Failed to create subscription');
    return result;
}

async function rejectClaim(user, claimId) {
    if (!user?.roles?.includes('ADMIN')) throw new ApiError(403, 'Forbidden');

    const claim = await subscriptionRepository.getClaimById(claimId);
    if (!claim) throw new ApiError(404, 'Claim not found');
    if (claim.status !== 'CLAIMED') throw new ApiError(409, 'Claim is already reviewed');

    return subscriptionRepository.rejectClaim({ claimId, reviewedByUserId: user.id });
}

async function getReport(user, { month, year }) {
    if (!user?.roles?.includes('ADMIN')) throw new ApiError(403, 'Forbidden');

    const startInclusive = startOfMonthUtc(year, month);
    const endExclusive = startOfNextMonthUtc(year, month);

    const rows = await subscriptionRepository.listSubscriptionsInRange({ startInclusive, endExclusive });

    return {
        month,
        year,
        startInclusive,
        endExclusive,
        rows
    };
}

module.exports = {
    getSettings,
    updateSettings,
    getMySubscriptionOverview,
    createMyClaim,
    listAdminSellers,
    adminDeleteUnverifiedSeller,
    listClaims,
    approveClaim,
    rejectClaim,
    getReport
};
