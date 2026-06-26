const { z } = require('zod');

function preprocessBoolean(value) {
    if (value === undefined || value === null) return false;
    if (typeof value === 'boolean') return value;
    if (typeof value === 'number') return value === 1;
    const s = String(value).trim().toLowerCase();
    return s === 'true' || s === '1' || s === 'yes' || s === 'y';
}

const createAgreementSchema = z.object({
    body: z.object({
        deviceId: z.string().min(1, 'Device is required'),
        sharedExchangeDeviceId: z.string().min(1, 'Shared exchange device is required').optional(),
        buyerEmail: z.string().email('Enter a valid buyer email'),
        buyerNationalId: z.string().min(5, 'Buyer national ID must be at least 5 characters').optional(),
        buyerFullName: z.string().min(2, 'Buyer full name must be at least 2 characters'),
        buyerLocation: z.string().min(2, 'Buyer location must be at least 2 characters'),
        price: z.union([z.string().min(1, 'Price is required'), z.number()]),
        currency: z.string().min(3, 'Currency is required').max(5).optional().default('USD'),
        terms: z.string().min(10, 'Agreement terms are required'),
        sendEmail: z.preprocess(preprocessBoolean, z.boolean()).optional().default(false)
    }),
    params: z.object({}).default({}),
    query: z.object({}).default({})
});

const confirmAgreementSchema = z.object({
    body: z.object({}).default({}),
    params: z.object({
        id: z.string().min(1)
    }),
    query: z.object({}).default({})
});

const listAgreementsSchema = z.object({
    body: z.object({}).default({}),
    params: z.object({}).default({}),
    query: z.object({
        limit: z.string().optional(),
        skip: z.string().optional()
    }).default({})
});


const getAgreementSchema = z.object({
    body: z.object({}).default({}),
    params: z.object({
        id: z.string().min(1)
    }),
    query: z.object({}).default({})
});

const getAgreementDocumentSchema = z.object({
    body: z.object({}).default({}),
    params: z.object({
        id: z.string().min(1)
    }),
    query: z.object({
        token: z.string().min(10).optional(),
        download: z.string().optional()
    }).default({})
});

const getAgreementDocumentTokenSchema = z.object({
    body: z.object({}).default({}),
    params: z.object({
        id: z.string().min(1)
    }),
    query: z.object({}).default({})
});

const deleteAgreementSchema = z.object({
    body: z.object({}).default({}),
    params: z.object({
        id: z.string().min(1)
    }),
    query: z.object({}).default({})
});

const publicAgreementSchema = z.object({
    body: z.object({}).default({}),
    params: z.object({
        id: z.string().min(1)
    }),
    query: z.object({
        token: z.string().min(10)
    })
});

const publicConfirmAgreementSchema = z.object({
    body: z.object({
        token: z.string().min(10)
    }),
    params: z.object({
        id: z.string().min(1)
    }),
    query: z.object({}).default({})
});

module.exports = {
    createAgreementSchema,
    confirmAgreementSchema,
    listAgreementsSchema,
    getAgreementSchema,
    deleteAgreementSchema,
    getAgreementDocumentSchema,
    getAgreementDocumentTokenSchema,
    publicAgreementSchema,
    publicConfirmAgreementSchema
};

