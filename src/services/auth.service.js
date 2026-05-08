const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { sendVerificationEmail, sendPasswordResetEmail } = require('../utils/email');

const env = require('../config/env');
const { ApiError } = require('../utils/errors');
const { hashPassword, verifyPassword } = require('../utils/hash');
const authRepository = require('../repositories/auth.repository');

function signToken({ userId, type }) {
    return jwt.sign(
        {
            type
        },
        env.JWT_SECRET,
        {
            subject: userId,
            expiresIn: env.JWT_EXPIRES_IN
        }
    );
}

async function register({ email, phone, fullName, password, businessName, type = 'INDIVIDUAL' }) {
    const userType = type || 'INDIVIDUAL';

    if (!['INDIVIDUAL', 'SHOP', 'ADMIN'].includes(userType)) {
        throw new ApiError(422, 'Invalid user type');
    }

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
            type: userType,
            passwordHash,
            isActive: true,
            emailVerified: false,
            verificationToken,
            resetPasswordToken: null,
            resetPasswordExpires: null,
            passwordExpiresAt: null
        });

        if (userType === 'SHOP') {
            await authRepository.createSellerProfile(existing.id);
            if (businessName) {
                await authRepository.updateSellerByUserId(existing.id, { businessName });
            }
        } else {
            await authRepository.createBuyerProfile(existing.id);
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
        type: userType,
        passwordHash,
        verificationToken
    });

    if (userType === 'SHOP') {
        await authRepository.createSellerProfile(user.id);
        if (businessName) {
            await authRepository.updateSellerByUserId(user.id, { businessName });
        }
    } else {
        await authRepository.createBuyerProfile(user.id);
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

async function clientRegister({ email, phone, fullName, password }) {
    const existing = await authRepository.findUserByEmail(email);
    if (existing && existing.emailVerified) throw new ApiError(409, 'Email already registered');

    if (existing && !existing.emailVerified) {
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
            type: 'INDIVIDUAL',
            passwordHash,
            isActive: true,
            emailVerified: false,
            verificationToken,
            resetPasswordToken: null,
            resetPasswordExpires: null,
            passwordExpiresAt: null
        });
        await authRepository.createBuyerProfile(existing.id);

        try {
            await sendVerificationEmail(email, verificationToken);
        } catch (err) {
            const logger = require('../utils/logger');
            logger.error('Failed to resend verification email after client re-registration:', err);
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
        type: 'INDIVIDUAL',
        passwordHash,
        verificationToken
    });
    await authRepository.createBuyerProfile(user.id);

    try {
        await sendVerificationEmail(email, verificationToken);
    } catch (err) {
        const logger = require('../utils/logger');
        logger.error('Failed to send initial verification email for client registration:', err);
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
        resetPasswordExpires: null,
        passwordExpiresAt: null
    });

    return { message: 'Password reset successful' };
}

async function login({ email, password }) {
    const user = await authRepository.findUserByEmail(email);
    if (!user || !user.isActive) throw new ApiError(401, 'Invalid credentials');

    const ok = await verifyPassword(password, user.passwordHash);
    if (!ok) throw new ApiError(401, 'Invalid credentials');

    if (user.passwordExpiresAt && user.passwordExpiresAt < new Date()) {
        throw new ApiError(401, 'Your password has expired. Please reset it.');
    }

    if (!user.emailVerified) {
        throw new ApiError(401, 'Please verify your email before logging in.');
    }

    const token = signToken({ userId: user.id, type: user.type });

    return {
        user: {
            id: user.id,
            email: user.email,
            fullName: user.fullName,
            type: user.type,
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

    if (user.passwordExpiresAt && user.passwordExpiresAt < new Date()) {
        throw new ApiError(401, 'Your password has expired. Please reset it.');
    }

    // Client login is for INDIVIDUAL users only
    if (user.type !== 'INDIVIDUAL') throw new ApiError(403, 'Client login is only for individual users');

    const token = signToken({ userId: user.id, type: user.type });

    return {
        user: {
            id: user.id,
            email: user.email,
            fullName: user.fullName,
            type: user.type,
            sellerId: user.seller?.id || null,
            buyerId: user.buyer?.id || null
        },
        token
    };
}

module.exports = {
    register,
    clientRegister,
    login,
    clientLogin,
    verifyEmail,
    resendVerification,
    forgotPassword,
    resetPassword
};
