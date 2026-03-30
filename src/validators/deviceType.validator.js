const { z } = require('zod');

const createDeviceTypeSchema = z.object({
    body: z.object({
        name: z.string().min(2),
        description: z.string().optional()
    }),
    params: z.object({}).default({}),
    query: z.object({}).default({})
});

const createDeviceFieldSchema = z.object({
    body: z.object({
        key: z.string().min(1).regex(/^[a-z][a-z0-9_]*$/, 'Use snake_case key'),
        label: z.string().min(1),
        dataType: z.enum(['STRING', 'NUMBER', 'BOOLEAN', 'DATE', 'ENUM']),
        required: z.boolean().optional().default(false),
        options: z.array(z.string()).optional(),
        sortOrder: z.number().int().optional().default(0)
    }),
    params: z.object({
        id: z.string().min(1)
    }),
    query: z.object({}).default({})
});

const updateDeviceTypeSchema = z.object({
    body: z
        .object({
            name: z.string().min(2).optional(),
            description: z.string().optional()
        })
        .refine((v) => Object.keys(v).length > 0, { message: 'At least one field is required' }),
    params: z.object({
        id: z.string().min(1)
    }),
    query: z.object({}).default({})
});

const deleteDeviceTypeSchema = z.object({
    body: z.object({}).default({}),
    params: z.object({
        id: z.string().min(1)
    }),
    query: z.object({}).default({})
});

const updateDeviceFieldSchema = z.object({
    body: z
        .object({
            label: z.string().min(1).optional(),
            required: z.boolean().optional(),
            options: z.array(z.string()).optional(),
            sortOrder: z.number().int().optional()
        })
        .refine((v) => Object.keys(v).length > 0, { message: 'At least one field is required' }),
    params: z.object({
        id: z.string().min(1),
        fieldId: z.string().min(1)
    }),
    query: z.object({}).default({})
});

const deviceFieldParamsSchema = z.object({
    body: z.object({}).default({}),
    params: z.object({
        id: z.string().min(1),
        fieldId: z.string().min(1)
    }),
    query: z.object({}).default({})
});

module.exports = {
    createDeviceTypeSchema,
    createDeviceFieldSchema,
    updateDeviceTypeSchema,
    deleteDeviceTypeSchema,
    updateDeviceFieldSchema,
    deviceFieldParamsSchema
};
