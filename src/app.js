require('./config/env');

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const pinoHttp = require('pino-http');

const env = require('./config/env');
const logger = require('./utils/logger');
const routes = require('./routes');
const errorMiddleware = require('./middlewares/error.middleware');
const { configureCloudinary } = require('./config/cloudinary');

configureCloudinary();

const app = express();

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
