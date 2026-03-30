const { prisma } = require('../config/database');

async function createAgreement(data) {
    return prisma.agreement.create({ data });
}

async function findAgreementById(id) {
    return prisma.agreement.findUnique({
        where: { id },
        // Optimization: avoid overfetching (payments + full device + full user rows).
        // N+1 risk note: Prisma batches relation reads; keep selects narrow to reduce payload + CPU.
        select: {
            id: true,
            deviceId: true,
            sellerId: true,
            buyerId: true,
            price: true,
            currency: true,
            terms: true,
            status: true,
            isImmutable: true,
            acceptedAt: true,
            deviceSnapshot: true,
            createdAt: true,
            updatedAt: true,
            device: {
                select: {
                    id: true,
                    title: true,
                    deviceType: {
                        select: { id: true, name: true }
                    }
                }
            },
            seller: {
                select: {
                    id: true,
                    businessName: true,
                    tinNumber: true,
                    phone: true,
                    whatsapp: true,
                    location: true,
                    floor: true,
                    logoUrl: true,
                    user: {
                        select: {
                            id: true,
                            email: true,
                            fullName: true
                        }
                    }
                }
            },
            buyer: {
                select: {
                    id: true,
                    user: {
                        select: {
                            id: true,
                            email: true,
                            fullName: true,
                            nationalId: true,
                            clientCode: true
                        }
                    }
                }
            }
        }
    });
}

async function setAgreementAccepted({ agreementId, deviceSnapshot }) {
    return prisma.agreement.update({
        where: { id: agreementId },
        data: {
            status: 'ACCEPTED',
            isImmutable: true,
            acceptedAt: new Date(),
            deviceSnapshot
        }
    });
}

async function updateAgreementTerms(agreementId, terms) {
    return prisma.agreement.update({
        where: { id: agreementId },
        data: { terms }
    });
}

async function setDeviceSold(deviceId) {
    return prisma.device.update({
        where: { id: deviceId },
        data: { status: 'SOLD' }
    });
}

async function listAgreementsAsSeller(sellerId, options = {}) {
    // Performance note: for large datasets, consider a composite index on (sellerId, createdAt) and/or (sellerId, status).
    return prisma.agreement.findMany({
        where: { sellerId },
        // Optimization: select only fields used by frontend lists (no payments).
        select: {
            id: true,
            deviceId: true,
            sellerId: true,
            buyerId: true,
            price: true,
            currency: true,
            terms: true,
            status: true,
            acceptedAt: true,
            createdAt: true,
            device: {
                select: {
                    id: true,
                    title: true,
                    deviceType: {
                        select: { id: true, name: true }
                    }
                }
            },
            seller: {
                select: {
                    id: true,
                    businessName: true,
                    tinNumber: true,
                    phone: true,
                    whatsapp: true,
                    location: true,
                    floor: true,
                    logoUrl: true,
                    user: { select: { id: true, email: true, fullName: true } }
                }
            },
            buyer: {
                select: {
                    id: true,
                    user: { select: { id: true, email: true, fullName: true } }
                }
            }
        },
        orderBy: { createdAt: 'desc' },
        take: options.limit ? Number(options.limit) : undefined,
        skip: options.skip ? Number(options.skip) : undefined
    });
}


async function listAgreementsAsBuyer(buyerId, options = {}) {
    // Performance note: for large datasets, consider a composite index on (buyerId, createdAt) and/or (buyerId, status).
    return prisma.agreement.findMany({
        where: { buyerId },
        // Optimization: select only fields used by frontend lists (no payments).
        select: {
            id: true,
            deviceId: true,
            sellerId: true,
            buyerId: true,
            price: true,
            currency: true,
            terms: true,
            status: true,
            acceptedAt: true,
            createdAt: true,
            device: {
                select: {
                    id: true,
                    title: true,
                    deviceType: {
                        select: { id: true, name: true }
                    }
                }
            },
            seller: {
                select: {
                    id: true,
                    businessName: true,
                    tinNumber: true,
                    phone: true,
                    whatsapp: true,
                    location: true,
                    floor: true,
                    logoUrl: true,
                    user: { select: { id: true, email: true, fullName: true } }
                }
            },
            buyer: {
                select: {
                    id: true,
                    user: { select: { id: true, email: true, fullName: true } }
                }
            }
        },
        orderBy: { createdAt: 'desc' },
        take: options.limit ? Number(options.limit) : undefined,
        skip: options.skip ? Number(options.skip) : undefined
    });
}


async function getStatsForSeller(sellerId) {
    // Optimization: groupBy() replaces multiple count() queries.
    // Index suggestion: a composite index on (sellerId, status) can help this aggregation.
    const grouped = await prisma.agreement.groupBy({
        by: ['status'],
        where: { sellerId },
        _count: { _all: true }
    });

    const countsByStatus = grouped.reduce((acc, row) => {
        acc[row.status] = row._count._all;
        return acc;
    }, {});

    const pending = countsByStatus.PENDING || 0;
    const accepted = countsByStatus.ACCEPTED || 0;
    const total = Object.values(countsByStatus).reduce((sum, v) => sum + v, 0);

    return { total, pending, accepted };
}


async function deleteAgreement(id) {
    return prisma.agreement.delete({
        where: { id }
    });
}

module.exports = {
    createAgreement,
    findAgreementById,
    setAgreementAccepted,
    updateAgreementTerms,
    setDeviceSold,
    listAgreementsAsSeller,
    listAgreementsAsBuyer,
    getStatsForSeller,
    deleteAgreement
};

