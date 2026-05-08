const jwt = require('jsonwebtoken');

const env = require('../config/env');
const { ApiError } = require('../utils/errors');
const authRepository = require('../repositories/auth.repository');
const { getRequestContext } = require('../utils/requestContext');

const defaultCacheTtlMs = process.env.NODE_ENV === 'development' ? 5000 : 0;
const authUserCacheTtlMs = Number(process.env.AUTH_USER_CACHE_TTL_MS || defaultCacheTtlMs);
const authUserCache = new Map();

async function getAuthUserCached(userId) {
    if (!authUserCacheTtlMs || authUserCacheTtlMs <= 0) {
        return authRepository.getAuthUserById(userId);
    }

    const now = Date.now();
    const cached = authUserCache.get(userId);

    if (cached) {
        if (cached.value && cached.expiresAt > now) return cached.value;
        if (cached.inFlight) return cached.inFlight;
    }

    const inFlight = authRepository
        .getAuthUserById(userId)
        .then((value) => {
            authUserCache.set(userId, { value, expiresAt: Date.now() + authUserCacheTtlMs });
            return value;
        })
        .catch((err) => {
            authUserCache.delete(userId);
            throw err;
        });

    authUserCache.set(userId, { inFlight, expiresAt: now + authUserCacheTtlMs });
    return inFlight;
}

async function authMiddleware(req, res, next) {
    try {
        const startAtNs = process.hrtime.bigint();

        const header = req.headers.authorization;
        if (!header || !header.startsWith('Bearer ')) {
            throw new ApiError(401, 'Missing Authorization header');
        }

        const token = header.slice('Bearer '.length).trim();

        let payload;
        try {
            payload = jwt.verify(token, env.JWT_SECRET);
        } catch {
            throw new ApiError(401, 'Invalid or expired token');
        }

        const userId = payload.sub;
        if (!userId) throw new ApiError(401, 'Invalid token payload');

        const authUser = await getAuthUserCached(userId);
        if (!authUser || !authUser.isActive) throw new ApiError(401, 'User not authorized');

        req.user = authUser;

        const ctx = getRequestContext();
        if (ctx) ctx.authTimeMs += Number(process.hrtime.bigint() - startAtNs) / 1e6;

        return next();
    } catch (err) {
        return next(err);
    }
}

module.exports = authMiddleware;
