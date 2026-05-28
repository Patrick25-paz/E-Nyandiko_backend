/* Seed admin user based on new database structure (SHOP, INDIVIDUAL, ADMIN).
   Usage: npm run seed
*/

require('dotenv').config();

const prisma = require('../src/database/prisma');
const { hashPassword } = require('../src/utils/hash');

function truthy(v) {
    return ['1', 'true', 'yes', 'y', 'on'].includes(String(v || '').toLowerCase());
}

async function upsertUser({ email, fullName, password, updatePassword, type }) {
    const existing = await prisma.user.findUnique({ where: { email } });

    if (existing) {
        if (!updatePassword) {
            return prisma.user.update({
                where: { email },
                data: { fullName, type }
            });
        }

        const passwordHash = await hashPassword(password);
        return prisma.user.update({
            where: { email },
            data: { fullName, passwordHash, type }
        });
    }

    const passwordHash = await hashPassword(password);
    return prisma.user.create({
        data: {
            email,
            fullName,
            passwordHash,
            type
        }
    });
}

async function main() {
    // Seed admin user only
    const updatePasswords = truthy(process.env.SEED_UPDATE_PASSWORDS);

    const adminUser = {
        email: process.env.SEED_ADMIN_EMAIL || 'admin@enyandiko.com',
        fullName: 'Admin',
        password: process.env.SEED_ADMIN_PASSWORD || 'Admin@2026',
        type: 'ADMIN'
    };

    const user = await upsertUser({
        email: adminUser.email,
        fullName: adminUser.fullName,
        password: adminUser.password,
        updatePassword: updatePasswords,
        type: adminUser.type
    });

    console.log(`✓ Admin user seeded: ${user.email}`);
}

main()
    .then(() => prisma.$disconnect())
    .catch(async (e) => {
        console.error(e);
        await prisma.$disconnect();
        process.exit(1);
    });
