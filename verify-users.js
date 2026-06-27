const prisma = require('./src/database/prisma');

async function main() {
    const res = await prisma.user.updateMany({
        data: {
            emailVerified: true
        }
    });
    console.log('Successfully verified users:', res.count);
    
    // Also, let's print all users and their subscription status to see what is in the DB.
    const users = await prisma.user.findMany({
        include: {
            seller: {
                include: {
                    subscriptions: true,
                    subscriptionClaims: true
                }
            }
        }
    });
    console.log('Current Users in DB:');
    for (const u of users) {
        console.log(`- Email: ${u.email}, Type: ${u.type}, Verified: ${u.emailVerified}`);
        if (u.seller) {
            console.log(`  Seller ID: ${u.seller.id}`);
            console.log(`  Subscriptions:`, u.seller.subscriptions);
            console.log(`  Claims:`, u.seller.subscriptionClaims);
        }
    }
}

main()
    .then(() => prisma.$disconnect())
    .catch((err) => {
        console.error(err);
        prisma.$disconnect();
    });
