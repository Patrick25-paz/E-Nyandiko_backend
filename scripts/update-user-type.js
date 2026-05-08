require('dotenv').config();

const prisma = require('../src/database/prisma');

const ALLOWED_TYPES = new Set(['INDIVIDUAL', 'SHOP', 'ADMIN']);

async function main() {
    const [emailArg = 'seller@enyandiko.com', typeArg = 'SHOP'] = process.argv.slice(2);
    const email = String(emailArg).trim().toLowerCase();
    const type = String(typeArg).trim().toUpperCase();

    if (!email) {
        throw new Error('Email is required.');
    }

    if (!ALLOWED_TYPES.has(type)) {
        throw new Error(`Invalid type "${type}". Allowed values: ${Array.from(ALLOWED_TYPES).join(', ')}`);
    }

    const existingUser = await prisma.user.findUnique({
        where: { email },
        select: { id: true, email: true, fullName: true, type: true }
    });

    if (!existingUser) {
        throw new Error(`User not found for email "${email}".`);
    }

    const updatedUser = await prisma.user.update({
        where: { email },
        data: { type },
        select: { id: true, email: true, fullName: true, type: true }
    });

    console.log('User type updated successfully.');
    console.log(updatedUser);
}

main()
    .catch((error) => {
        console.error('Failed to update user type.');
        console.error(error.message);
        process.exitCode = 1;
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
