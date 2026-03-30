const { prisma } = require('../config/database');

async function findSellerByUserId(userId) {
    return prisma.seller.findUnique({
        where: { userId },
        // Optimization: avoid including the full User row (contains passwordHash).
        // Frontend profile uses seller fields only; auth context provides user fields.
        select: {
            id: true,
            userId: true,
            businessName: true,
            tinNumber: true,
            phone: true,
            whatsapp: true,
            location: true,
            floor: true,
            logoUrl: true,
            logoPublicId: true,
            createdAt: true,
            updatedAt: true
        }
    });
}

async function updateSellerProfile(userId, data) {
    return prisma.seller.update({
        where: { userId },
        data
    });
}

async function searchClients(sellerId, query) {
    return prisma.user.findMany({
        where: {
            roles: { some: { role: { name: 'BUYER' } } },
            OR: [
                { fullName: { contains: query, mode: 'insensitive' } },
                { nationalId: { contains: query, mode: 'insensitive' } },
                { email: { contains: query, mode: 'insensitive' } },
                { clientCode: { contains: query, mode: 'insensitive' } },
                { phone: { contains: query, mode: 'insensitive' } }
            ]
        },
        take: 10,
        include: {
            buyer: {
                include: {
                    agreementsAsBuyer: {
                        where: { sellerId },
                        orderBy: { createdAt: 'desc' },
                        take: 1
                    }
                }
            }
        }
    });
}

module.exports = {
    findSellerByUserId,
    updateSellerProfile,
    searchClients
};
