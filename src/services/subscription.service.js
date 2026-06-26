const { ApiError } = require('../utils/errors');
const subscriptionRepository = require('../repositories/subscription.repository');
const { TtlCache } = require('../utils/ttlCache');

const settingsCache = new TtlCache({ defaultTtlMs: Number(process.env.CACHE_SETTINGS_TTL_MS || 30_000) });
const adminSellersCache = new TtlCache({ defaultTtlMs: Number(process.env.CACHE_ADMIN_SELLERS_TTL_MS || 60_000) });
const adminClaimsCache = new TtlCache({ defaultTtlMs: Number(process.env.CACHE_ADMIN_CLAIMS_TTL_MS || 30_000) });
const adminReportCache = new TtlCache({ defaultTtlMs: Number(process.env.CACHE_ADMIN_REPORT_TTL_MS || 30_000) });

function invalidateAdminSubscriptionCaches() {
    adminSellersCache.clear();
    adminClaimsCache.clear();
    adminReportCache.clear();
}

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
    return settingsCache.getOrSet('settings', () => subscriptionRepository.getOrCreateSettings());
}

async function updateSettings(user, { monthlyFee, currency, paymentNumber, whatsappNumber, receiverNames, registerDeviceFee, stolenDeviceFee, extraDeviceFee }) {
    if (user?.type !== 'ADMIN') throw new ApiError(403, 'Forbidden');

    const updated = await subscriptionRepository.updateSettings({ monthlyFee, currency, paymentNumber, whatsappNumber, receiverNames, registerDeviceFee, stolenDeviceFee, extraDeviceFee });
    settingsCache.set('settings', updated);
    invalidateAdminSubscriptionCaches();
    return updated;
}

async function getMySubscriptionOverview(user) {
    if (!user?.sellerId) throw new ApiError(403, 'Seller profile required');

    const now = new Date();
    const [settings, active, latest, pendingClaim] = await Promise.all([
        settingsCache.getOrSet('settings', () => subscriptionRepository.getOrCreateSettings()),
        subscriptionRepository.findActiveSubscriptionBySellerId(user.sellerId, now),
        subscriptionRepository.findLatestSubscriptionBySellerId(user.sellerId),
        subscriptionRepository.findPendingClaimBySellerId(user.sellerId)
    ]);

    // Atomically expire any ACTIVE subscriptions that have ended.
    await subscriptionRepository.expireDueSubscriptions(now);

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
        settingsCache.getOrSet('settings', () => subscriptionRepository.getOrCreateSettings()),
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
    if (user?.type !== 'ADMIN') throw new ApiError(403, 'Forbidden');

    const formatSellerLocation = (seller) => {
        const parts = [seller?.province, seller?.district, seller?.sector, seller?.cell, seller?.village].filter(Boolean);
        const extras = [
            seller?.noticeableName ? `Near ${seller.noticeableName}` : null,
            seller?.houseName ? `House: ${seller.houseName}` : null,
            seller?.floor ? `Floor: ${seller.floor}` : null
        ].filter(Boolean);
        const base = parts.join(', ');
        const extra = extras.length ? ` (${extras.join(', ')})` : '';
        const formatted = (base || extra) ? `${base}${extra}`.trim() : null;
        return formatted || seller?.location || '-';
    };

    return adminSellersCache.getOrSet('adminSellers', async () => {
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
                location: formatSellerLocation(s),
                status,
                subscription: latest,
                pendingClaim
            };
        });
    });
}

async function adminDeleteUnverifiedSeller(user, sellerId) {
    if (user?.type !== 'ADMIN') throw new ApiError(403, 'Forbidden');

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
    const deleted = await subscriptionRepository.deleteUserById(seller.userId);
    invalidateAdminSubscriptionCaches();
    return deleted;
}

async function listClaims(user, { status, limit, skip }) {
    if (user?.type !== 'ADMIN') throw new ApiError(403, 'Forbidden');
    const key = `claims:${status || 'ALL'}:${limit || '30'}:${skip || '0'}`;
    return adminClaimsCache.getOrSet(key, () => subscriptionRepository.listClaims({ status }, { limit, skip }));
}

async function approveClaim(user, claimId) {
    if (user?.type !== 'ADMIN') throw new ApiError(403, 'Forbidden');

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
    invalidateAdminSubscriptionCaches();
    return result;
}

async function rejectClaim(user, claimId) {
    if (user?.type !== 'ADMIN') throw new ApiError(403, 'Forbidden');

    const claim = await subscriptionRepository.getClaimById(claimId);
    if (!claim) throw new ApiError(404, 'Claim not found');
    if (claim.status !== 'CLAIMED') throw new ApiError(409, 'Claim is already reviewed');

    const updated = await subscriptionRepository.rejectClaim({ claimId, reviewedByUserId: user.id });
    invalidateAdminSubscriptionCaches();
    return updated;
}

async function getReport(user, { month, year }) {
    if (user?.type !== 'ADMIN') throw new ApiError(403, 'Forbidden');

    const cacheKey = `report:${year}-${month}`;
    const ttlMs = Number(process.env.CACHE_ADMIN_REPORT_TTL_MS || 30_000);
    return adminReportCache.getOrSet(
        cacheKey,
        async () => {
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
        },
        ttlMs
    );
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
