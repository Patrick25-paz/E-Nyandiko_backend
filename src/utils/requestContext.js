const { AsyncLocalStorage } = require('node:async_hooks');
const crypto = require('node:crypto');

const requestContextStorage = new AsyncLocalStorage();

function createRequestContext() {
    return {
        requestId: crypto.randomUUID(),
        startAtNs: process.hrtime.bigint(),
        authTimeMs: 0,
        dbQueries: 0,
        dbTimeMs: 0
    };
}

function requestContextMiddleware(req, res, next) {
    const ctx = createRequestContext();

    requestContextStorage.run(ctx, () => {
        // Expose id for debugging (not used for auth).
        req.requestId = ctx.requestId;

        next();
    });
}

function getRequestContext() {
    return requestContextStorage.getStore() || null;
}

module.exports = {
    requestContextMiddleware,
    getRequestContext
};
