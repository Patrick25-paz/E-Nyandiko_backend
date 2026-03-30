const { ZodError } = require('zod');
const { fail } = require('../utils/response');
const logger = require('../utils/logger');

// Centralized error handler
function errorMiddleware(err, req, res, next) {
    if (res.headersSent) return next(err);

    if (err instanceof ZodError) {
        return fail(res, {
            statusCode: 422,
            message: 'Validation error',
            errors: err.flatten()
        });
    }

    const statusCode = err.statusCode || 500;
    const message = err.message || 'Internal Server Error';

    if (statusCode >= 500) {
        logger.error({ err }, 'Unhandled error');
    }

    return fail(res, {
        statusCode,
        message,
        errors: err.details || null
    });
}

module.exports = errorMiddleware;
