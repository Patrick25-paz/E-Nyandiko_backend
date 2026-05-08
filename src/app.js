require('./config/env');

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const pinoHttp = require('pino-http');

const env = require('./config/env');
const logger = require('./utils/logger');
const { requestContextMiddleware, getRequestContext } = require('./utils/requestContext');
const routes = require('./routes');
const errorMiddleware = require('./middlewares/error.middleware');
const { configureCloudinary } = require('./config/cloudinary');

configureCloudinary();

const app = express();

// For JSON APIs, ETag/304 adds CPU + DB cost (the handler still runs to compute the response body).
// Disable to keep repeated fetches fast and predictable.
app.set('etag', false);

app.use(
    helmet({
        // Allow the frontend to embed the PDF document endpoint in an iframe (same origin via proxy).
        frameguard: { action: 'sameorigin' },
        contentSecurityPolicy: {
            directives: {
                ...helmet.contentSecurityPolicy.getDefaultDirectives(),
                // Allow same-origin framing so the /api/agreements/:id/document endpoint
                // can be rendered inside an <iframe> on the frontend.
                'frame-ancestors': ["'self'"]
            }
        }
    })
);
app.use(
    cors({
        origin: env.CORS_ORIGIN === '*' ? true : env.CORS_ORIGIN.split(','),
        credentials: true
    })
);

app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true }));

app.use(requestContextMiddleware);

// Log a breakdown only when requests are slow (keeps logs readable).
app.use((req, res, next) => {
    const ctx = getRequestContext();
    if (!ctx) return next();

    res.on('finish', () => {
        const totalMs = Number(process.hrtime.bigint() - ctx.startAtNs) / 1e6;
        const slowRequestMs = Number(process.env.SLOW_REQUEST_MS || 800);
        const slowDbMs = Number(process.env.SLOW_DB_MS || 500);

        if (slowRequestMs > 0 && totalMs < slowRequestMs && slowDbMs > 0 && ctx.dbTimeMs < slowDbMs) return;

        logger.warn(
            {
                requestId: ctx.requestId,
                method: req.method,
                url: req.originalUrl || req.url,
                statusCode: res.statusCode,
                totalMs: Math.round(totalMs),
                authMs: Math.round(ctx.authTimeMs),
                dbMs: Math.round(ctx.dbTimeMs),
                dbQueries: ctx.dbQueries
            },
            'Slow request breakdown'
        );
    });

    return next();
});

app.use(
    pinoHttp({
        logger,
        redact: ['req.headers.authorization']
    })
);

app.use('/api', routes);

// 404
app.use((req, res) => {
    res.status(404).json({ success: false, message: 'Route not found' });
});

app.use(errorMiddleware);

module.exports = app;
