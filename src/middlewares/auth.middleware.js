const jwt = require('jsonwebtoken');

const env = require('../config/env');
const { ApiError } = require('../utils/errors');
const authRepository = require('../repositories/auth.repository');

async function authMiddleware(req, res, next) {
    try {
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

        const authUser = await authRepository.getAuthUserById(userId);
        if (!authUser || !authUser.isActive) throw new ApiError(401, 'User not authorized');

        req.user = authUser;
        return next();
    } catch (err) {
        return next(err);
    }
}

module.exports = authMiddleware;
