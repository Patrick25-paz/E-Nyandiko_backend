const { ApiError } = require('../utils/errors');

/**
 * Middleware to require ADMIN type
 * @returns {Function} Express middleware
 */
function requireAdmin(req, res, next) {
    const userType = req.user?.type;

    if (userType !== 'ADMIN') {
        return next(new ApiError(403, 'Forbidden - Admin access required'));
    }

    return next();
}

module.exports = requireAdmin;
