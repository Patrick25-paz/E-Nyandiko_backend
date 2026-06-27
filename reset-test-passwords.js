const prisma = require('./src/database/prisma');
const { hashPassword } = require('./src/utils/hash');

async function main() {
    const passwordHash = await hashPassword('Password123');
    
    await prisma.user.updateMany({
        where: {
            email: {
                in: ['patrickmbabazi2004@gmail.com', 'niyimenyaeliane25@gmail.com']
            }
        },
        data: {
            passwordHash
        }
    });
    console.log('Successfully updated passwords for testing users.');
}

main()
    .then(() => prisma.$disconnect())
    .catch((err) => {
        console.error(err);
        prisma.$disconnect();
    });
