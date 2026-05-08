const { PrismaClient } = require('@prisma/client');

const logger = require('../utils/logger');
const { getRequestContext } = require('../utils/requestContext');

const basePrisma = new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['query', 'warn', 'error'] : ['warn', 'error']
});


const prisma = basePrisma.$extends({
    query: {
        $allModels: {
            async $allOperations({ model, operation, args, query }) {
                const startAtNs = process.hrtime.bigint();
                try {
                    return await query(args);
                } finally {
                    const durationMs = Number(process.hrtime.bigint() - startAtNs) / 1e6;

                    const ctx = getRequestContext();
                    if (ctx) {
                        ctx.dbQueries += 1;
                        ctx.dbTimeMs += durationMs;
                    }

                    const slowQueryThresholdMs = Number(process.env.PRISMA_SLOW_QUERY_MS || 200);
                    if (slowQueryThresholdMs > 0 && durationMs >= slowQueryThresholdMs) {
                        logger.warn(
                            {
                                model,
                                operation,
                                durationMs: Math.round(durationMs)
                            },
                            'Slow Prisma query'
                        );
                    }
                }
            }
        }
    }
});

module.exports = prisma;
