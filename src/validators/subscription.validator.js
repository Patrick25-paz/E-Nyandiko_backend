const { z } = require('zod');

const settingsId = 'default';

const getSettingsSchema = z.object({
    body: z.object({}).default({}),
    params: z.object({}).default({}),
    query: z.object({}).default({})
});

const updateSettingsSchema = z.object({
    body: z.object({
        monthlyFee: z.number().int().min(1),
        currency: z.string().min(1).optional(),
        paymentNumber: z.string().min(1).optional(),
        whatsappNumber: z.string().optional(),
        receiverNames: z.string().optional()
    }),
    params: z.object({}).default({}),
    query: z.object({}).default({})
});

const getMySubscriptionSchema = z.object({
    body: z.object({}).default({}),
    params: z.object({}).default({}),
    query: z.object({}).default({})
});

const createClaimSchema = z.object({
    body: z.object({}).default({}),
    params: z.object({}).default({}),
    query: z.object({}).default({})
});

const listAdminSellersSchema = z.object({
    body: z.object({}).default({}),
    params: z.object({}).default({}),
    query: z.object({}).default({})
});

const adminDeleteSellerSchema = z.object({
    body: z.object({}).default({}),
    params: z.object({
        sellerId: z.string().min(1)
    }),
    query: z.object({}).default({})
});

const listClaimsSchema = z.object({
    body: z.object({}).default({}),
    params: z.object({}).default({}),
    query: z.object({
        status: z.enum(['CLAIMED', 'APPROVED', 'REJECTED']).optional()
    }).default({})
});

const reviewClaimSchema = z.object({
    body: z.object({}).default({}),
    params: z.object({
        id: z.string().min(1)
    }),
    query: z.object({}).default({})
});

const reportSchema = z.object({
    body: z.object({}).default({}),
    params: z.object({}).default({}),
    query: z.object({
        month: z.coerce.number().int().min(1).max(12),
        year: z.coerce.number().int().min(2026)
    })
});

module.exports = {
    settingsId,
    getSettingsSchema,
    updateSettingsSchema,
    getMySubscriptionSchema,
    createClaimSchema,
    listAdminSellersSchema,
    adminDeleteSellerSchema,
    listClaimsSchema,
    reviewClaimSchema,
    reportSchema
};
