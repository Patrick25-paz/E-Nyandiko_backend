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
    passwordHash: true,
    isActive: true,
    emailVerified: true,
    verificationToken: true,
    resetPasswordToken: true,
    resetPasswordExpires: true,
    roles: {
        select: {
            role: {
                select: {
                    name: true
                }
            }
        }
    },
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

async function ensureRoleExists(name) {
    return prisma.role.upsert({
        where: { name },
        update: {},
        create: { name }
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

async function assignRole(userId, roleName) {
    const role = await ensureRoleExists(roleName);

    await prisma.userRole.upsert({
        where: { userId_roleId: { userId, roleId: role.id } },
        update: {},
        create: { userId, roleId: role.id }
    });

    return role;
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
        // Optimization: narrow select (no need to load unrelated columns).
        select: {
            id: true,
            email: true,
            fullName: true,
            isActive: true,
            roles: {
                select: {
                    role: {
                        select: {
                            name: true
                        }
                    }
                }
            },
            seller: { select: { id: true } },
            buyer: { select: { id: true } }
        }
    });

    if (!user) return null;

    return {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        isActive: user.isActive,
        roles: user.roles.map((ur) => ur.role.name),
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
    assignRole,
    createSellerProfile,
    updateSellerByUserId,
    createBuyerProfile,
    getAuthUserById
};
