require('./config/env');

const app = require('./app');
const env = require('./config/env');
const { connectDatabase, disconnectDatabase } = require('./config/database');
const logger = require('./utils/logger');
const { startSubscriptionExpiryJob } = require('./jobs/subscriptionExpiry.job');

async function start() {
    await connectDatabase();

    startSubscriptionExpiryJob();

    const server = app.listen(env.PORT, () => {
        logger.info({ port: env.PORT }, 'API server listening');
    });

    const shutdown = async (signal) => {
        logger.info({ signal }, 'Shutting down');
        server.close(async () => {
            await disconnectDatabase();
            process.exit(0);
        });
    };

    process.on('SIGINT', shutdown);
    process.on('SIGTERM', shutdown);
}

start().catch((err) => {
    logger.error({ err }, 'Failed to start server');
    process.exit(1);
});
