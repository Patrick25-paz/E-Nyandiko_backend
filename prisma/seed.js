/* Seed roles and an initial admin user (optional).
   Usage: npm run seed
*/

require('dotenv').config();

const prisma = require('../src/database/prisma');
const { hashPassword } = require('../src/utils/hash');

function truthy(v) {
    return ['1', 'true', 'yes', 'y', 'on'].includes(String(v || '').toLowerCase());
}

async function ensureUserRole(userId, roleName) {
    const role = await prisma.role.findUnique({ where: { name: roleName } });
    if (!role) throw new Error(`Role not found: ${roleName}`);

    await prisma.userRole.upsert({
        where: { userId_roleId: { userId, roleId: role.id } },
        update: {},
        create: { userId, roleId: role.id }
    });
}

async function upsertUser({ email, fullName, password, updatePassword }) {
    const existing = await prisma.user.findUnique({ where: { email } });

    if (existing) {
        if (!updatePassword) {
            return prisma.user.update({
                where: { email },
                data: { fullName }
            });
        }

        const passwordHash = await hashPassword(password);
        return prisma.user.update({
            where: { email },
            data: { fullName, passwordHash }
        });
    }

    const passwordHash = await hashPassword(password);
    return prisma.user.create({
        data: {
            email,
            fullName,
            passwordHash
        }
    });
}

async function main() {
    const roles = ['ADMIN', 'SELLER', 'BUYER'];

    for (const name of roles) {
        await prisma.role.upsert({
            where: { name },
            update: {},
            create: { name }
        });
    }

    // Demo users for local/dev
    // Passwords can be controlled via:
    // - SEED_PASSWORD (global fallback)
    // - SEED_ADMIN_PASSWORD / SEED_SELLER_PASSWORD / SEED_BUYER_PASSWORD
    // Set SEED_UPDATE_PASSWORDS=true to overwrite existing passwords.

    const defaultPassword = process.env.SEED_PASSWORD || 'ChangeMe@2026';
    const updatePasswords = truthy(process.env.SEED_UPDATE_PASSWORDS);

    const usersToSeed = [
        {
            email: process.env.SEED_ADMIN_EMAIL || 'admin@enyandiko.com',
            fullName: 'Admin',
            password: process.env.SEED_ADMIN_PASSWORD || defaultPassword,
            role: 'ADMIN'
        },
        {
            email: process.env.SEED_SELLER_EMAIL || 'seller@enyandiko.com',
            fullName: 'Seller',
            password: process.env.SEED_SELLER_PASSWORD || defaultPassword,
            role: 'SELLER'
        },
        {
            email: process.env.SEED_BUYER_EMAIL || 'buyer@enyandiko.com',
            fullName: 'Buyer',
            password: process.env.SEED_BUYER_PASSWORD || defaultPassword,
            role: 'BUYER'
        }
    ];

    for (const u of usersToSeed) {
        const user = await upsertUser({
            email: u.email,
            fullName: u.fullName,
            password: u.password,
            updatePassword: updatePasswords
        });

        await ensureUserRole(user.id, u.role);

        if (u.role === 'SELLER') {
            await prisma.seller.upsert({
                where: { userId: user.id },
                update: {},
                create: { userId: user.id }
            });
        }

        if (u.role === 'BUYER') {
            await prisma.buyer.upsert({
                where: { userId: user.id },
                update: {},
                create: { userId: user.id }
            });
        }
    }
}

main()
    .then(() => prisma.$disconnect())
    .catch(async (e) => {
        // eslint-disable-next-line no-console
        console.error(e);
        await prisma.$disconnect();
        process.exit(1);
    });
