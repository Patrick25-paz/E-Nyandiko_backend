const { ApiError } = require('../utils/errors');

/**
 * Middleware to require specific user types
 * @param {...string} allowed - User types (INDIVIDUAL, SHOP)
 * @returns {Function} Express middleware
 */
function requireType(...allowed) {
    const allowedSet = new Set(allowed.flat());

    return (req, res, next) => {
        const userType = req.user?.type;

        if (!userType || !allowedSet.has(userType)) {
            return next(new ApiError(403, 'Forbidden'));
        }

        return next();
    };
}

module.exports = requireType;
