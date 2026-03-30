const { z } = require('zod');

const registerSchema = z.object({
    body: z.object({
        email: z.string().email(),
        phone: z.string().min(7).optional(),
        fullName: z.string().min(2),
        password: z.string().min(8),
        businessName: z.string().optional()
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

module.exports = {
    registerSchema,
    loginSchema,
    clientLoginSchema,
    verifyEmailSchema,
    forgotPasswordSchema,
    resetPasswordSchema,
    resendVerificationSchema
};
