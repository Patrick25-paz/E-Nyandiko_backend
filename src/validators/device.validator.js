const { z } = require('zod');

const createDeviceSchema = z.object({
    body: z.object({
        deviceTypeId: z.string().min(1),
        title: z.string().optional(),
        // For multipart requests this comes in as a string; service will JSON.parse it
        fields: z.string().optional()
    }),
    params: z.object({}).default({}),
    query: z.object({}).default({})
});

const getDeviceSchema = z.object({
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
    getDeviceSchema,
    listDevicesSchema
};
