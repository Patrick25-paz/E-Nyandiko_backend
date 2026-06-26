const { z } = require('zod');

const updateSellerProfileSchema = z.object({
    body: z.object({
        businessName: z.string().min(2).max(100).optional(),
        tinNumber: z.string().min(5).max(20).optional(),
        phone: z.string().min(10, 'Please provide a valid phone number (at least 10 digits)').max(20).optional(),
        whatsapp: z.string().min(10, 'Please provide a valid WhatsApp number (at least 10 digits)').max(20).optional(),
        // Legacy free-form location (optional)
        location: z.string().min(2).max(200).optional(),

        // Structured address fields (optional)
        province: z.string().min(2).max(60).optional(),
        district: z.string().min(2).max(60).optional(),
        sector: z.string().min(2).max(60).optional(),
        cell: z.string().min(2).max(60).optional(),
        village: z.string().min(2).max(60).optional(),
        noticeableName: z.string().min(2).max(80).optional(),
        houseName: z.string().min(2).max(80).optional(),

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
