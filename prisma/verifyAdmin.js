const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function verifyAdmin() {
    try {
        const result = await prisma.user.update({
            where: { email: 'admin@enyandiko.com' },
            data: { emailVerified: true },
        });
        console.log('Admin verified:', result);
    } catch (error) {
        console.error('Error:', error);
    } finally {
        await prisma.$disconnect();
    }
}

verifyAdmin();