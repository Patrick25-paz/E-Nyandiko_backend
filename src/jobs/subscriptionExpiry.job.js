const cron = require('node-cron');

const logger = require('../utils/logger');
const subscriptionRepository = require('../repositories/subscription.repository');

async function runExpirySweep({ reason }) {
    const now = new Date();

    try {
        await subscriptionRepository.normalizeActiveSubscriptionsEndAtToEndOfDay();
        const { count } = await subscriptionRepository.expireDueSubscriptions(now);
        logger.info({ reason, count, now }, 'Subscription expiry sweep completed');
    } catch (err) {
        logger.error({ err, reason }, 'Subscription expiry sweep failed');
    }
}

function startSubscriptionExpiryJob() {
    // Catch up overdue subscriptions at startup.
    runExpirySweep({ reason: 'startup' });

    // Run daily at 23:59:59 Africa/Kigali time.
    cron.schedule(
        '59 59 23 * * *',
        () => {
            runExpirySweep({ reason: 'daily-23:59:59' });
        },
        { timezone: 'Africa/Kigali' }
    );

    logger.info({ timezone: 'Africa/Kigali' }, 'Subscription expiry cron scheduled (23:59:59 daily)');
}

module.exports = {
    startSubscriptionExpiryJob
};
