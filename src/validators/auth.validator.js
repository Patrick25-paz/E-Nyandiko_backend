const { z } = require('zod');

const registerSchema = z.object({
    body: z.object({
        email: z.string().email(),
        phone: z.string().min(7),
        fullName: z.string().min(2),
        password: z.string().min(8),
        businessName: z.string().optional(),
        type: z.enum(['SHOP']).optional()
    }),
    params: z.object({}).default({}),
    query: z.object({}).default({})
});

const clientRegisterSchema = z.object({
    body: z.object({
        email: z.string().email(),
        phone: z.string().min(7),
        fullName: z.string().min(2),
        password: z.string().min(8),
        type: z.enum(['INDIVIDUAL']).optional()
    }),
    params: z.object({}).default({}),
    query: z.object({}).default({})
});

const loginSchema = z.object({
    body: z.object({
        email: z.string().email(),
        password: z.string().min(1)
    }),
    params: z.object({}).default({}),
    query: z.object({}).default({})
});

const clientLoginSchema = z.object({
    body: z.object({
        identifier: z.string().min(1),
        pin: z.string().min(4)
    }),
    params: z.object({}).default({}),
    query: z.object({}).default({})
});

const verifyEmailSchema = z.object({
    body: z.object({
        token: z.string().min(1)
    }),
    params: z.object({}).default({}),
    query: z.object({}).default({})
});

const forgotPasswordSchema = z.object({
    body: z.object({
        email: z.string().email()
    }),
    params: z.object({}).default({}),
    query: z.object({}).default({})
});

const resetPasswordSchema = z.object({
    body: z.object({
        token: z.string().min(1),
        password: z.string().min(8)
    }),
    params: z.object({}).default({}),
    query: z.object({}).default({})
});

const resendVerificationSchema = z.object({
    body: z.object({
        userId: z.string().optional(),
        email: z.string().email().optional()
    }),
    params: z.object({}).default({}),
    query: z.object({}).default({})
});

const updateMeSchema = z.object({
    body: z.object({
        fullName: z.string().min(2).max(120).optional(),
        phone: z.string().min(7).max(20).optional(),
        nationalId: z.string().min(5).max(30).optional(),
        province: z.string().min(2).max(120).optional(),
        district: z.string().min(2).max(120).optional(),
        sector: z.string().min(2).max(120).optional(),
        cell: z.string().min(2).max(120).optional(),
        village: z.string().min(2).max(120).optional(),
        noticeableName: z.string().max(120).optional(),
        houseName: z.string().max(120).optional(),
        floor: z.string().max(120).optional()
    }),
    params: z.object({}).default({}),
    query: z.object({}).default({})
});

module.exports = {
    registerSchema,
    clientRegisterSchema,
    loginSchema,
    clientLoginSchema,
    verifyEmailSchema,
    forgotPasswordSchema,
    resetPasswordSchema,
    resendVerificationSchema,
    updateMeSchema
};
