const { z } = require('zod');

const updateSellerProfileSchema = z.object({
    body: z.object({
        businessName: z.string().min(2).max(100).optional(),
        tinNumber: z.string().min(5).max(20).optional(),
        phone: z.string().min(10).max(20).optional(),
        whatsapp: z.string().min(10).max(20).optional(),
        location: z.string().min(2).max(200).optional(),
        floor: z.string().min(1).max(20).optional(),
        logoUrl: z.string().url().optional(),
        logoPublicId: z.string().optional()
    }),
    params: z.object({}).default({}),
    query: z.object({}).default({})
});

module.exports = {
    updateSellerProfileSchema
};
