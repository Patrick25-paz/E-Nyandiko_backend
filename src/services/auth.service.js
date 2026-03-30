const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { sendVerificationEmail, sendPasswordResetEmail } = require('../utils/email');

const env = require('../config/env');
const { ApiError } = require('../utils/errors');
const { hashPassword, verifyPassword } = require('../utils/hash');
const authRepository = require('../repositories/auth.repository');

function signToken({ userId, roles }) {
    return jwt.sign(
        {
            roles
        },
        env.JWT_SECRET,
        {
            subject: userId,
            expiresIn: env.JWT_EXPIRES_IN
        }
    );
}

async function register({ email, phone, fullName, password, businessName }) {
    const existing = await authRepository.findUserByEmail(email);
    if (existing && existing.emailVerified) throw new ApiError(409, 'Email already registered');

    if (existing && !existing.emailVerified) {
        // Allow re-registering an unverified email by overwriting the pending account.
        // This helps users who mistyped details the first time.
        if (phone) {
            const phoneOwner = await authRepository.findUserByPhone(phone);
            if (phoneOwner && phoneOwner.id !== existing.id) {
                throw new ApiError(409, 'Phone number already registered');
            }
        }

        const passwordHash = await hashPassword(password);
        const verificationToken = Math.floor(100000 + Math.random() * 900000).toString();

        await authRepository.updateUser(existing.id, {
            email,
            phone: phone || null,
            fullName,
            passwordHash,
            isActive: true,
            emailVerified: false,
            verificationToken,
            resetPasswordToken: null,
            resetPasswordExpires: null
        });

        // Ensure the expected role/profile exist for this registration flow.
        const role = 'SELLER';
        await authRepository.assignRole(existing.id, role);
        await authRepository.createSellerProfile(existing.id);

        if (businessName) {
            await authRepository.updateSellerByUserId(existing.id, { businessName });
        }

        try {
            await sendVerificationEmail(email, verificationToken);
        } catch (err) {
            const logger = require('../utils/logger');
            logger.error('Failed to resend verification email after re-registration:', err);
        }

        return {
            message: 'Account updated. Please check your email to verify your account before logging in.'
        };
    }

    const passwordHash = await hashPassword(password);
    const verificationToken = Math.floor(100000 + Math.random() * 900000).toString();

    const user = await authRepository.createUser({
        email,
        phone: phone || null,
        fullName,
        passwordHash,
        verificationToken
    });

    // Default to SELLER for this specific registration flow
    const role = 'SELLER';
    await authRepository.assignRole(user.id, role);
    await authRepository.createSellerProfile(user.id);

    if (businessName) {
        // Update seller profile with business name if provided
        const seller = await authRepository.getAuthUserById(user.id);
        if (seller.sellerId) {
            const { prisma } = require('../config/database');
            await prisma.seller.update({
                where: { id: seller.sellerId },
                data: { businessName }
            });
        }
    }

    try {
        await sendVerificationEmail(email, verificationToken);
    } catch (err) {
        // Log but don't fail registration if email fails
        const logger = require('../utils/logger');
        logger.error('Failed to send initial verification email:', err);
    }

    return {
        message: 'Registration successful. Please check your email to verify your account before logging in.'
    };
}

async function verifyEmail(token) {
    if (!token) throw new ApiError(400, 'Verification token is required');

    const user = await authRepository.findUserByVerificationToken(token);
    if (!user) throw new ApiError(400, 'Invalid or expired verification token');

    await authRepository.updateUser(user.id, {
        emailVerified: true,
        verificationToken: null
    });

    return { message: 'Email verified successfully' };
}

async function resendVerification(userId, email) {
    let user;
    if (userId) {
        user = await authRepository.findUserById(userId);
    } else if (email) {
        user = await authRepository.findUserByEmail(email);
    }

    if (!user) throw new ApiError(404, 'User not found');
    if (user.emailVerified) throw new ApiError(400, 'Email already verified');

    const verificationToken = Math.floor(100000 + Math.random() * 900000).toString();
    await authRepository.updateUser(user.id, { verificationToken });

    await sendVerificationEmail(user.email, verificationToken);
    return { message: 'Verification email resent' };
}

async function forgotPassword(email) {
    const user = await authRepository.findUserByEmail(email);
    // Security: Don't reveal if user exists or not
    if (!user) return { message: 'If that email is registered, a reset link has been sent' };

    const resetPasswordToken = crypto.randomBytes(32).toString('hex');
    const resetPasswordExpires = new Date(Date.now() + 3600000); // 1 hour

    await authRepository.updateUser(user.id, {
        resetPasswordToken,
        resetPasswordExpires
    });

    await sendPasswordResetEmail(user.email, resetPasswordToken);

    return { message: 'If that email is registered, a reset link has been sent' };
}

async function resetPassword(token, newPassword) {
    if (!token) throw new ApiError(400, 'Reset token is required');

    const user = await authRepository.findUserByResetToken(token);
    if (!user || !user.resetPasswordExpires || user.resetPasswordExpires < new Date()) {
        throw new ApiError(400, 'Invalid or expired reset token');
    }

    const passwordHash = await hashPassword(newPassword);

    await authRepository.updateUser(user.id, {
        passwordHash,
        resetPasswordToken: null,
        resetPasswordExpires: null
    });

    return { message: 'Password reset successful' };
}

async function login({ email, password }) {
    const user = await authRepository.findUserByEmail(email);
    if (!user || !user.isActive) throw new ApiError(401, 'Invalid credentials');

    const ok = await verifyPassword(password, user.passwordHash);
    if (!ok) throw new ApiError(401, 'Invalid credentials');

    if (!user.emailVerified) {
        throw new ApiError(401, 'Please verify your email before logging in.');
    }

    const roles = user.roles.map((ur) => ur.role.name);

    const token = signToken({ userId: user.id, roles });

    return {
        user: {
            id: user.id,
            email: user.email,
            fullName: user.fullName,
            roles,
            sellerId: user.seller?.id || null,
            buyerId: user.buyer?.id || null
        },
        token
    };
}

async function clientLogin({ identifier, pin }) {
    const user = await authRepository.findUserByIdentifier(identifier);
    if (!user || !user.isActive) throw new ApiError(401, 'Invalid credentials');

    const ok = await verifyPassword(pin, user.passwordHash);
    if (!ok) throw new ApiError(401, 'Invalid credentials');

    if (!user.emailVerified) {
        throw new ApiError(401, 'Please verify your email before logging in.');
    }

    const roles = user.roles.map((ur) => ur.role.name);
    if (!roles.includes('BUYER')) throw new ApiError(403, 'Client login is only for buyers');

    const token = signToken({ userId: user.id, roles });

    return {
        user: {
            id: user.id,
            email: user.email,
            fullName: user.fullName,
            roles,
            sellerId: user.seller?.id || null,
            buyerId: user.buyer?.id || null
        },
        token
    };
}

module.exports = {
    register,
    login,
    clientLogin,
    verifyEmail,
    resendVerification,
    forgotPassword,
    resetPassword
};
