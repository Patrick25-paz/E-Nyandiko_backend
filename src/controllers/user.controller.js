const prisma = require('../database/prisma');
const { ApiError } = require('../utils/errors');
const logger = require('../config/env').logger;

/**
 * Admin: Delete a user and all their related data
 * @param {Object} req - Express request
 * @param {string} req.params.userId - User ID to delete
 * @param {Object} res - Express response
 * @returns {Promise<void>}
 */
async function deleteUser(req, res, next) {
    try {
        const { userId } = req.params;
        const adminId = req.user.id;

        // Prevent admin from deleting themselves
        if (userId === adminId) {
            return next(new ApiError(400, 'Cannot delete yourself'));
        }

        // Check if user exists
        const user = await prisma.user.findUnique({
            where: { id: userId },
            include: {
                seller: {
                    include: {
                        devices: true,
                        agreementsAsSeller: true
                    }
                },
                buyer: {
                    include: {
                        agreementsAsBuyer: true
                    }
                }
            }
        });

        if (!user) {
            return next(new ApiError(404, 'User not found'));
        }

        // Delete user (cascading deletes will handle related data)
        await prisma.user.delete({
            where: { id: userId }
        });

        logger.info({
            userId: adminId,
            deletedUserId: userId,
            msg: 'User deleted by admin'
        });

        res.json({
            success: true,
            message: `User ${user.email} and all related data deleted successfully`
        });
    } catch (error) {
        next(error);
    }
}

/**
 * Admin: List all users with optional filters
 * @param {Object} req - Express request
 * @param {Object} res - Express response
 * @returns {Promise<void>}
 */
async function listUsers(req, res, next) {
    try {
        const {
            skip = 0,
            take = 20,
            search = '',
            type = '',
            isActive = ''
        } = req.query;

        const skipVal = Math.max(0, parseInt(skip) || 0);
        const takeVal = Math.min(100, Math.max(1, parseInt(take) || 20));

        const where = {
            AND: [
                search ? {
                    OR: [
                        { email: { contains: search, mode: 'insensitive' } },
                        { fullName: { contains: search, mode: 'insensitive' } },
                        { phone: { contains: search, mode: 'insensitive' } }
                    ]
                } : {},
                type ? { type: { equals: type } } : {},
                isActive !== '' ? { isActive: { equals: isActive === 'true' } } : {}
            ]
        };

        const [users, total] = await Promise.all([
            prisma.user.findMany({
                where,
                select: {
                    id: true,
                    email: true,
                    fullName: true,
                    phone: true,
                    type: true,
                    isActive: true,
                    emailVerified: true,
                    createdAt: true,
                    seller: {
                        select: { id: true }
                    },
                    buyer: {
                        select: { id: true }
                    }
                },
                orderBy: { createdAt: 'desc' },
                skip: skipVal,
                take: takeVal
            }),
            prisma.user.count({ where })
        ]);

        res.json({
            data: users,
            pagination: {
                total,
                skip: skipVal,
                take: takeVal,
                pages: Math.ceil(total / takeVal)
            }
        });
    } catch (error) {
        next(error);
    }
}

/**
 * Admin: Update user type and/or active status
 * @param {Object} req - Express request
 * @param {Object} res - Express response
 * @returns {Promise<void>}
 */
async function updateUser(req, res, next) {
    try {
        const { userId } = req.params;
        const { type, isActive } = req.body;

        const user = await prisma.user.findUnique({
            where: { id: userId }
        });

        if (!user) {
            return next(new ApiError(404, 'User not found'));
        }

        const updateData = {};
        if (type !== undefined) updateData.type = type;
        if (isActive !== undefined) updateData.isActive = isActive;

        const updatedUser = await prisma.user.update({
            where: { id: userId },
            data: updateData,
            select: {
                id: true,
                email: true,
                fullName: true,
                type: true,
                isActive: true,
                createdAt: true
            }
        });

        logger.info({
            userId: req.user.id,
            updatedUserId: userId,
            changes: updateData,
            msg: 'User updated by admin'
        });

        res.json(updatedUser);
    } catch (error) {
        next(error);
    }
}

module.exports = {
    deleteUser,
    listUsers,
    updateUser
};
