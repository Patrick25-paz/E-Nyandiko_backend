const { ApiError } = require('../utils/errors');

function requireRoles(...allowed) {
    const allowedSet = new Set(allowed.flat());

    return (req, res, next) => {
        const roles = req.user?.roles || [];
        const ok = roles.some((r) => allowedSet.has(r));

        if (!ok) {
            return next(new ApiError(403, 'Forbidden'));
        }

        return next();
    };
}

module.exports = requireRoles;
