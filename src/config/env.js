const dotenv = require('dotenv');
const path = require('path');
const { z } = require('zod');
const { URL } = require('url');

const backendEnvPath = path.resolve(__dirname, '../../.env');
dotenv.config({ path: backendEnvPath });

// Fallback for alternate launch contexts where a root .env may exist.
dotenv.config();

function normalizeDatabaseUrl(rawUrl) {
    if (!rawUrl) return rawUrl;

    // Use WHATWG URL to safely manage query params like sslmode/connection_limit.
    // This helps avoid Prisma pool timeouts when running behind Supabase/pgBouncer.
    const url = new URL(String(rawUrl));
    const params = url.searchParams;
    const isSupabasePooler = url.hostname.includes('.pooler.supabase.com');

    // Supabase hosted Postgres (and pooler) typically requires SSL.
    if (!params.get('sslmode')) params.set('sslmode', 'require');

    // Supabase pooler needs Prisma's pgBouncer mode to avoid connection issues.
    if (isSupabasePooler && !params.get('pgbouncer')) {
        params.set('pgbouncer', 'true');
    }

    // Prisma pool defaults can be too low when the frontend triggers parallel requests.
    // Allow overriding via env vars, but ensure sane defaults.
    const desiredConnectionLimit = Number(process.env.PRISMA_CONNECTION_LIMIT || 5);
    const desiredPoolTimeout = Number(process.env.PRISMA_POOL_TIMEOUT || 60);

    const currentLimitRaw = params.get('connection_limit');
    const currentLimit = currentLimitRaw ? Number(currentLimitRaw) : NaN;
    if (!currentLimitRaw || Number.isNaN(currentLimit) || currentLimit < desiredConnectionLimit) {
        params.set('connection_limit', String(desiredConnectionLimit));
    }

    if (!params.get('pool_timeout')) {
        params.set('pool_timeout', String(desiredPoolTimeout));
    }

    return url.toString();
}

if (process.env.DATABASE_URL) {
    process.env.DATABASE_URL = normalizeDatabaseUrl(process.env.DATABASE_URL);
}

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
