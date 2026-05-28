const { ZodError } = require('zod');
const { fail } = require('../utils/response');
const logger = require('../utils/logger');

function flattenZodError(error) {
    const flattened = error.flatten();
    const mapped = {};

    if (flattened.formErrors?.length) {
        mapped._form = flattened.formErrors;
    }

    for (const [key, messages] of Object.entries(flattened.fieldErrors || {})) {
        if (!messages || messages.length === 0) continue;
        mapped[key] = messages;
    }

    return mapped;
}

// Centralized error handler
function errorMiddleware(err, req, res, next) {
    if (res.headersSent) return next(err);

    if (err instanceof ZodError) {
        return fail(res, {
            statusCode: 422,
            message: 'Validation error',
            errors: flattenZodError(err)
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
