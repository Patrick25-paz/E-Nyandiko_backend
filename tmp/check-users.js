require('dotenv').config({ path: 'backend/.env' });
require('../src/config/env');

const prisma = require('../src/database/prisma');

async function checkUsers() {
    try {
        const users = await prisma.user.findMany({
            select: { id: true, email: true, fullName: true, type: true },
            take: 10
        });
        console.log('Users in database:', users);
    } catch (error) {
        console.error('Error:', error);
    } finally {
        await prisma.$disconnect();
    }
}

checkUsers();