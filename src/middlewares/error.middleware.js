const { ZodError } = require('zod');
const { Prisma } = require('@prisma/client');
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
        const cleanKey = key.replace(/^(body|params|query)\./, '');
        mapped[cleanKey] = messages;
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

    let statusCode = err.statusCode || 500;
    let message = err.message || 'Internal Server Error';
    let details = err.details || null;

    // Detect and handle Prisma Database Errors
    const isPrismaError =
        err instanceof Prisma.PrismaClientKnownRequestError ||
        err instanceof Prisma.PrismaClientUnknownRequestError ||
        err instanceof Prisma.PrismaClientRustPanicError ||
        err instanceof Prisma.PrismaClientInitializationError ||
        err instanceof Prisma.PrismaClientValidationError ||
        (err.name && err.name.startsWith('PrismaClient'));

    if (isPrismaError) {
        // Log full database error details on the server console for debugging
        logger.error({ err }, 'Database operation failed');

        statusCode = 500;
        message = 'We had trouble processing your request. Please try again.';

        // Include raw message in details for non-production environments
        if (process.env.NODE_ENV !== 'production') {
            details = {
                originalError: err.message,
                code: err.code,
                meta: err.meta
            };
        }

        if (err instanceof Prisma.PrismaClientInitializationError) {
            message = 'We had trouble processing your request. Please try again.';
        } else if (err instanceof Prisma.PrismaClientKnownRequestError) {
            switch (err.code) {
                case 'P1001':
                case 'P1002':
                case 'P1008':
                case 'P1017':
                    message = 'We had trouble processing your request. Please try again.';
                    break;
                case 'P2002':
                    statusCode = 409; // Conflict
                    message = 'A record with this information already exists.';
                    break;
                case 'P2025':
                    statusCode = 404; // Not Found
                    message = 'The requested record was not found.';
                    break;
                case 'P2003':
                    statusCode = 400; // Bad Request
                    message = 'This action cannot be completed because a related record is missing or required.';
                    break;
                default:
                    message = 'We had trouble processing your request. Please try again.';
                    break;
            }
        } else if (err instanceof Prisma.PrismaClientValidationError) {
            statusCode = 400;
            message = 'We had trouble processing your request. Please try again.';
        }
    } else {
        if (statusCode >= 500) {
            logger.error({ err }, 'Unhandled server error');
            if (process.env.NODE_ENV === 'production') {
                message = 'We had trouble processing your request. Please try again.';
            }
        }
    }

    return fail(res, {
        statusCode,
        message,
        errors: details
    });
}

module.exports = errorMiddleware;
