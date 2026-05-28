const { prisma } = require('../config/database');

// Optimization: prefer select over include to prevent overfetching.
// Note: we still select `passwordHash` where needed for auth flows.
const userAuthSelect = {
    id: true,
    email: true,
    clientCode: true,
    nationalId: true,
    phone: true,
    fullName: true,
    location: true,
    province: true,
    district: true,
    sector: true,
    cell: true,
    village: true,
    noticeableName: true,
    houseName: true,
    floor: true,
    profileImageUrl: true,
    profileImagePublicId: true,
    type: true,
    passwordHash: true,
    isActive: true,
    emailVerified: true,
    verificationToken: true,
    resetPasswordToken: true,
    resetPasswordExpires: true,
    passwordExpiresAt: true,
    seller: { select: { id: true } },
    buyer: { select: { id: true } }
};

async function findUserByEmail(email) {
    return prisma.user.findUnique({
        where: { email },
        select: userAuthSelect
    });
}

async function findUserByPhone(phone) {
    if (!phone) return null;
    return prisma.user.findUnique({
        where: { phone },
        select: userAuthSelect
    });
}

async function findUserByNationalId(nationalId) {
    if (!nationalId) return null;
    return prisma.user.findUnique({
        where: { nationalId },
        select: userAuthSelect
    });
}

async function findUserByClientCode(clientCode) {
    if (!clientCode) return null;
    return prisma.user.findUnique({
        where: { clientCode },
        select: userAuthSelect
    });
}

async function findUserByIdentifier(identifier) {
    if (!identifier) return null;
    return prisma.user.findFirst({
        where: {
            OR: [{ email: identifier }, { clientCode: identifier }, { nationalId: identifier }]
        },
        select: userAuthSelect
    });
}

async function findUserById(id) {
    return prisma.user.findUnique({
        where: { id },
        select: userAuthSelect
    });
}

async function createUser(data) {
    return prisma.user.create({ data });
}

async function updateUser(id, data) {
    return prisma.user.update({
        where: { id },
        data,
        select: userAuthSelect
    });
}

async function findUserByVerificationToken(verificationToken) {
    return prisma.user.findUnique({
        where: { verificationToken },
        select: userAuthSelect
    });
}

async function findUserByResetToken(resetPasswordToken) {
    return prisma.user.findUnique({
        where: { resetPasswordToken },
        select: userAuthSelect
    });
}

async function createSellerProfile(userId) {
    return prisma.seller.upsert({
        where: { userId },
        update: {},
        create: { userId }
    });
}

async function updateSellerByUserId(userId, data) {
    return prisma.seller.update({
        where: { userId },
        data
    });
}

async function createBuyerProfile(userId) {
    return prisma.buyer.upsert({
        where: { userId },
        update: {},
        create: { userId }
    });
}

async function getAuthUserById(userId) {
    const user = await prisma.user.findUnique({
        where: { id: userId },
        select: {
            id: true,
            email: true,
            fullName: true,
            phone: true,
            nationalId: true,
            location: true,
            province: true,
            district: true,
            sector: true,
            cell: true,
            village: true,
            noticeableName: true,
            houseName: true,
            floor: true,
            profileImageUrl: true,
            isActive: true,
            type: true,
            seller: { select: { id: true } },
            buyer: { select: { id: true } }
        }
    });

    if (!user) return null;

    return {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        phone: user.phone || null,
        nationalId: user.nationalId || null,
        location: user.location || null,
        province: user.province || null,
        district: user.district || null,
        sector: user.sector || null,
        cell: user.cell || null,
        village: user.village || null,
        noticeableName: user.noticeableName || null,
        houseName: user.houseName || null,
        floor: user.floor || null,
        profileImageUrl: user.profileImageUrl || null,
        isActive: user.isActive,
        type: user.type,
        sellerId: user.seller?.id || null,
        buyerId: user.buyer?.id || null
    };
}

module.exports = {
    findUserByEmail,
    findUserByPhone,
    findUserByNationalId,
    findUserByClientCode,
    findUserByIdentifier,
    findUserById,
    createUser,
    updateUser,
    findUserByVerificationToken,
    findUserByResetToken,
    createSellerProfile,
    updateSellerByUserId,
    createBuyerProfile,
    getAuthUserById
};
