const { prisma } = require('../config/database');
const { settingsId } = require('../validators/subscription.validator');

async function getOrCreateSettings() {
    return prisma.subscriptionSettings.upsert({
        where: { id: settingsId },
        update: {},
        create: { id: settingsId }
    });
}

async function updateSettings({ monthlyFee, currency, paymentNumber, whatsappNumber, receiverNames }) {
    return prisma.subscriptionSettings.upsert({
        where: { id: settingsId },
        update: {
            monthlyFee,
            ...(currency ? { currency } : {}),
            ...(typeof paymentNumber === 'string' ? { paymentNumber } : {}),
            ...(typeof whatsappNumber === 'string' ? { whatsappNumber } : {}),
            ...(typeof receiverNames === 'string' ? { receiverNames } : {})
        },
        create: {
            id: settingsId,
            monthlyFee,
            ...(currency ? { currency } : {}),
            ...(typeof paymentNumber === 'string' ? { paymentNumber } : {}),
            ...(typeof whatsappNumber === 'string' ? { whatsappNumber } : {}),
            ...(typeof receiverNames === 'string' ? { receiverNames } : {})
        }
    });
}

async function findSellerByUserId(userId) {
    return prisma.seller.findUnique({
        where: { userId },
        select: {
            id: true,
            userId: true,
            user: { select: { fullName: true, email: true, phone: true } }
        }
    });
}

async function findActiveSubscriptionBySellerId(sellerId, now) {
    return prisma.sellerSubscription.findFirst({
        where: {
            sellerId,
            status: 'ACTIVE',
            endAt: { gt: now }
        },
        orderBy: { endAt: 'desc' },
        select: {
            id: true,
            status: true,
            startAt: true,
            endAt: true,
            createdAt: true,
            claimId: true
        }
    });
}

async function findLatestSubscriptionBySellerId(sellerId) {
    return prisma.sellerSubscription.findFirst({
        where: { sellerId },
        orderBy: { endAt: 'desc' },
        select: {
            id: true,
            status: true,
            startAt: true,
            endAt: true,
            createdAt: true,
            claimId: true
        }
    });
}

async function expireSubscription(subscriptionId) {
    return prisma.sellerSubscription.update({
        where: { id: subscriptionId },
        data: { status: 'EXPIRED' }
    });
}

async function expireDueSubscriptions(now) {
    const result = await prisma.sellerSubscription.updateMany({
        where: {
            status: 'ACTIVE',
            endAt: { lte: now }
        },
        data: { status: 'EXPIRED' }
    });

    return { count: result.count };
}

async function normalizeActiveSubscriptionsEndAtToEndOfDay() {
    // Ensure ACTIVE subscriptions remain active through 23:59:59 of their end date.
    // Uses Postgres date_trunc to set endAt to end-of-day of the same date.
    // NOTE: This runs only for ACTIVE subscriptions to avoid rewriting historical records.
    await prisma.$executeRawUnsafe(
        'UPDATE "SellerSubscription" SET "endAt" = (((date_trunc(\'day\', "endAt" AT TIME ZONE \'Africa/Kigali\') + interval \'1 day\' - interval \'1 second\')) AT TIME ZONE \'Africa/Kigali\') WHERE "status" = \'ACTIVE\' AND "endAt" IS NOT NULL'
    );
}

async function findPendingClaimBySellerId(sellerId) {
    return prisma.subscriptionClaim.findFirst({
        where: { sellerId, status: 'CLAIMED' },
        orderBy: { createdAt: 'desc' },
        select: {
            id: true,
            sellerId: true,
            status: true,
            amount: true,
            currency: true,
            createdAt: true
        }
    });
}

async function createClaim({ sellerId, amount, currency }) {
    return prisma.subscriptionClaim.create({
        data: {
            sellerId,
            amount,
            currency: currency || 'RWF'
        },
        select: {
            id: true,
            sellerId: true,
            status: true,
            amount: true,
            currency: true,
            createdAt: true
        }
    });
}

async function listSellersWithLatestSubscription() {
    return prisma.seller.findMany({
        select: {
            id: true,
            userId: true,
            createdAt: true,
            businessName: true,
            phone: true,
            whatsapp: true,
            location: true,
            floor: true,
            user: { select: { fullName: true, email: true, phone: true, emailVerified: true } },
            subscriptions: {
                orderBy: { endAt: 'desc' },
                take: 1,
                select: {
                    id: true,
                    status: true,
                    startAt: true,
                    endAt: true,
                    createdAt: true,
                    claimId: true,
                    claim: {
                        select: {
                            id: true,
                            amount: true,
                            currency: true,
                            status: true,
                            createdAt: true,
                            reviewedAt: true
                        }
                    }
                }
            },
            subscriptionClaims: {
                where: { status: 'CLAIMED' },
                orderBy: { createdAt: 'desc' },
                take: 1,
                select: {
                    id: true,
                    status: true,
                    amount: true,
                    currency: true,
                    createdAt: true
                }
            }
        },
        orderBy: { createdAt: 'desc' }
    });
}

async function getSellerForAdminDelete(sellerId) {
    return prisma.seller.findUnique({
        where: { id: sellerId },
        select: {
            id: true,
            userId: true,
            user: { select: { id: true, email: true, fullName: true, emailVerified: true } },
            _count: {
                select: {
                    devices: true,
                    subscriptions: true,
                    subscriptionClaims: true,
                    agreementsAsSeller: true
                }
            }
        }
    });
}

async function deleteUserById(userId) {
    return prisma.user.delete({
        where: { id: userId },
        select: { id: true, email: true }
    });
}

async function listClaims({ status }) {
    return prisma.subscriptionClaim.findMany({
        where: status ? { status } : {},
        select: {
            id: true,
            sellerId: true,
            status: true,
            amount: true,
            currency: true,
            createdAt: true,
            reviewedAt: true,
            reviewedByUserId: true,
            seller: {
                select: {
                    id: true,
                    user: { select: { fullName: true, email: true, phone: true } }
                }
            },
            reviewedBy: { select: { id: true, fullName: true, email: true } }
        },
        orderBy: { createdAt: 'desc' }
    });
}

async function getClaimById(claimId) {
    return prisma.subscriptionClaim.findUnique({
        where: { id: claimId },
        select: {
            id: true,
            sellerId: true,
            status: true,
            amount: true,
            currency: true,
            createdAt: true,
            reviewedAt: true,
            reviewedByUserId: true
        }
    });
}

async function approveClaim({ claimId, reviewedByUserId, startAt, endAt }) {
    return prisma.$transaction(async (tx) => {
        const claim = await tx.subscriptionClaim.findUnique({ where: { id: claimId } });
        if (!claim) return { claim: null, subscription: null };

        const subscription = await tx.sellerSubscription.create({
            data: {
                sellerId: claim.sellerId,
                startAt,
                endAt,
                status: 'ACTIVE',
                claimId: claim.id
            },
            select: {
                id: true,
                sellerId: true,
                status: true,
                startAt: true,
                endAt: true,
                createdAt: true,
                claimId: true
            }
        });

        const updatedClaim = await tx.subscriptionClaim.update({
            where: { id: claimId },
            data: {
                status: 'APPROVED',
                reviewedAt: new Date(),
                reviewedByUserId
            },
            select: {
                id: true,
                sellerId: true,
                status: true,
                amount: true,
                currency: true,
                createdAt: true,
                reviewedAt: true,
                reviewedByUserId: true
            }
        });

        return { claim: updatedClaim, subscription };
    });
}

async function rejectClaim({ claimId, reviewedByUserId }) {
    return prisma.subscriptionClaim.update({
        where: { id: claimId },
        data: {
            status: 'REJECTED',
            reviewedAt: new Date(),
            reviewedByUserId
        },
        select: {
            id: true,
            sellerId: true,
            status: true,
            amount: true,
            currency: true,
            createdAt: true,
            reviewedAt: true,
            reviewedByUserId: true
        }
    });
}

async function listSubscriptionsInRange({ startInclusive, endExclusive }) {
    return prisma.sellerSubscription.findMany({
        where: {
            startAt: { gte: startInclusive, lt: endExclusive }
        },
        select: {
            id: true,
            sellerId: true,
            status: true,
            startAt: true,
            endAt: true,
            createdAt: true,
            claim: {
                select: {
                    id: true,
                    amount: true,
                    currency: true,
                    createdAt: true,
                    reviewedAt: true,
                    reviewedByUserId: true,
                    reviewedBy: { select: { fullName: true } }
                }
            },
            seller: {
                select: {
                    id: true,
                    user: { select: { fullName: true, email: true, phone: true } }
                }
            }
        },
        orderBy: { startAt: 'desc' }
    });
}

module.exports = {
    getOrCreateSettings,
    updateSettings,
    findSellerByUserId,
    findActiveSubscriptionBySellerId,
    findLatestSubscriptionBySellerId,
    expireSubscription,
    expireDueSubscriptions,
    normalizeActiveSubscriptionsEndAtToEndOfDay,
    findPendingClaimBySellerId,
    createClaim,
    listSellersWithLatestSubscription,
    getSellerForAdminDelete,
    deleteUserById,
    listClaims,
    getClaimById,
    approveClaim,
    rejectClaim,
    listSubscriptionsInRange
};
