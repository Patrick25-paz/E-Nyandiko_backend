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
            province: true,
            district: true,
            sector: true,
            cell: true,
            village: true,
            noticeableName: true,
            houseName: true,
            floor: true,
            logoUrl: true,
            logoPublicId: true,
            createdAt: true,
            updatedAt: true
        }
    });
}

async function findSellerById(id) {
    return prisma.seller.findUnique({
        where: { id },
        select: {
            id: true,
            userId: true,
            businessName: true,
            tinNumber: true,
            phone: true,
            whatsapp: true,
            location: true,
            province: true,
            district: true,
            sector: true,
            cell: true,
            village: true,
            noticeableName: true,
            houseName: true,
            floor: true,
            logoUrl: true,
            logoPublicId: true,
            createdAt: true,
            updatedAt: true,
            user: {
                select: {
                    id: true,
                    email: true,
                    fullName: true,
                    type: true
                }
            }
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
            type: 'INDIVIDUAL',
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

async function searchShops(query) {
    return prisma.seller.findMany({
        where: {
            user: { type: 'SHOP' },
            OR: [
                { businessName: { contains: query, mode: 'insensitive' } },
                { phone: { contains: query, mode: 'insensitive' } },
                { whatsapp: { contains: query, mode: 'insensitive' } },
                { location: { contains: query, mode: 'insensitive' } },
                { user: { fullName: { contains: query, mode: 'insensitive' } } },
                { user: { email: { contains: query, mode: 'insensitive' } } }
            ]
        },
        take: 10,
        select: {
            id: true,
            businessName: true,
            phone: true,
            whatsapp: true,
            location: true,
            province: true,
            district: true,
            sector: true,
            cell: true,
            village: true,
            noticeableName: true,
            houseName: true,
            floor: true,
            logoUrl: true,
            user: {
                select: {
                    id: true,
                    email: true,
                    fullName: true,
                    type: true
                }
            }
        }
    });
}

module.exports = {
    findSellerByUserId,
    findSellerById,
    updateSellerProfile,
    searchClients,
    searchShops
};
