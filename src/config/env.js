const dotenv = require('dotenv');
const { z } = require('zod');

dotenv.config();

const envSchema = z.object({
    NODE_ENV: z.string().optional().default('development'),
    PORT: z.coerce.number().optional().default(4000),

    DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),

    JWT_SECRET: z.string().min(20, 'JWT_SECRET must be at least 20 chars'),
    JWT_EXPIRES_IN: z.string().optional().default('7d'),

    CLOUDINARY_CLOUD_NAME: z.string().optional(),
    CLOUDINARY_API_KEY: z.string().optional(),
    CLOUDINARY_API_SECRET: z.string().optional(),
    CLOUDINARY_FOLDER: z.string().optional().default('e-nyandiko'),

    CORS_ORIGIN: z.string().optional().default('*'),
    RESEND_EMAIL_API_KEY: z.string().optional(),
    RESEND_FROM_EMAIL: z.string().optional(),
    FRONTEND_URL: z.string().optional().default('http://localhost:5173')
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
    // eslint-disable-next-line no-console
    console.error('Invalid environment variables:', parsed.error.flatten().fieldErrors);
    process.exit(1);
}

module.exports = parsed.data;
