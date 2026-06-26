const { z } = require('zod');

const createDeviceSchema = z.object({
    body: z.object({
        deviceTypeId: z.string().min(1),
        title: z.string().min(2, 'Title is required'),
        // For multipart requests this comes in as a string; service will JSON.parse it
        fields: z.string().optional()
    }),
    params: z.object({}).default({}),
    query: z.object({}).default({})
});

const updateDeviceSchema = z.object({
    body: z.object({
        title: z.string().min(2, 'Title is required'),
        fields: z.string().optional()
    }),
    params: z.object({
        id: z.string().min(1)
    }),
    query: z.object({}).default({})
});

const deleteDeviceSchema = z.object({
    body: z.object({}).default({}),
    params: z.object({
        id: z.string().min(1)
    }),
    query: z.object({}).default({})
});

const getDeviceSchema = z.object({
    body: z.object({}).default({}),
    params: z.object({
        id: z.string().min(1)
    }),
    query: z.object({}).default({})
});

const grantDeviceExchangeAccessSchema = z.object({
    body: z.object({
        grantedToSellerId: z.string().min(1)
    }),
    params: z.object({
        id: z.string().min(1)
    }),
    query: z.object({}).default({})
});

const revokeDeviceExchangeAccessSchema = z.object({
    body: z.object({}).default({}),
    params: z.object({
        id: z.string().min(1)
    }),
    query: z.object({}).default({})
});

const listDevicesSchema = z.object({
    body: z.object({}).default({}),
    params: z.object({}).default({}),
    query: z.object({
        limit: z.string().optional(),
        skip: z.string().optional()
    }).default({})
});


module.exports = {
    createDeviceSchema,
    updateDeviceSchema,
    deleteDeviceSchema,
    getDeviceSchema,
    grantDeviceExchangeAccessSchema,
    revokeDeviceExchangeAccessSchema,
    listDevicesSchema
};
