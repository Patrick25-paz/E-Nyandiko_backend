require('./config/env');

const app = require('./app');
const env = require('./config/env');
const { connectDatabase, disconnectDatabase } = require('./config/database');
const logger = require('./utils/logger');
const { startSubscriptionExpiryJob } = require('./jobs/subscriptionExpiry.job');

let shuttingDown = false;

async function start() {
    await connectDatabase();

    const subscriptionExpiryTask = startSubscriptionExpiryJob();

    const server = app.listen(env.PORT, '0.0.0.0', () => {
        logger.info({ port: env.PORT }, 'API server listening');
    });

    const shutdown = async (signal, { rethrowSignal } = {}) => {
        if (shuttingDown) return;
        shuttingDown = true;

        logger.info({ signal }, 'Shutting down');

        try {
            if (subscriptionExpiryTask && typeof subscriptionExpiryTask.stop === 'function') {
                subscriptionExpiryTask.stop();
            }
        } catch (err) {
            logger.warn({ err }, 'Failed to stop subscription expiry task');
        }

        const forceExitTimer = setTimeout(() => {
            logger.warn({ signal }, 'Forcing shutdown');
            process.exit(1);
        }, 10_000);
        forceExitTimer.unref?.();

        const finalize = async () => {
            try {
                await disconnectDatabase();
            } finally {
                clearTimeout(forceExitTimer);
                if (rethrowSignal) {
                    process.kill(process.pid, rethrowSignal);
                } else {
                    process.exit(0);
                }
            }
        };

        if (!server.listening) {
            await finalize();
            return;
        }

        server.close(() => {
            finalize().catch((err) => {
                logger.error({ err }, 'Shutdown finalize failed');
                process.exit(1);
            });
        });
    };

    process.on('SIGINT', shutdown);
    process.on('SIGTERM', shutdown);

    // Nodemon uses SIGUSR2 to trigger restarts.
    process.once('SIGUSR2', () => shutdown('SIGUSR2', { rethrowSignal: 'SIGUSR2' }));
}

start().catch((err) => {
    logger.error({ err }, 'Failed to start server');
    process.exit(1);
});
