const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function updateAdminUser() {
    try {
        const updated = await prisma.user.update({
            where: { email: 'admin@enyandiko.com' },
            data: { type: 'ADMIN' }
        });
        console.log('✓ User updated to ADMIN type:', {
            id: updated.id,
            email: updated.email,
            type: updated.type
        });
    } catch (err) {
        console.error('✗ Error updating user:', err.message);
        process.exit(1);
    } finally {
        await prisma.$disconnect();
    }
}

updateAdminUser();
