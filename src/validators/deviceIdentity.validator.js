const { z } = require('zod');

const registerDeviceIdentitySchema = z.object({
    body: z
        .object({
            deviceTypeId: z.string().min(1),
            imei: z.string().trim().min(1).optional(),
            serialNumber: z.string().trim().min(1).optional()
        })
        .refine((b) => Boolean(b.imei || b.serialNumber), {
            message: 'Provide imei or serialNumber'
        }),
    params: z.object({}),
    query: z.object({})
});

const reportStolenSchema = z.object({
    body: z
        .object({
            deviceTypeId: z.string().min(1),
            imei: z.string().trim().min(1).optional(),
            serialNumber: z.string().trim().min(1).optional(),
            description: z.string().trim().max(500).optional()
        })
        .refine((b) => Boolean(b.imei || b.serialNumber), {
            message: 'Provide imei or serialNumber'
        }),
    params: z.object({}),
    query: z.object({})
});

module.exports = {
    registerDeviceIdentitySchema,
    reportStolenSchema
};
