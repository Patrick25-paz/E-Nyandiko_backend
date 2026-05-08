require('dotenv').config({ path: '../.env' });
require('../src/config/env');
const prisma = require('../src/database/prisma');

(async () => {
  try {
    const sellers = await prisma.seller.findMany({
      select: {
        id: true,
        businessName: true,
        phone: true,
        whatsapp: true,
        location: true,
        user: { select: { id: true, email: true, fullName: true, type: true } }
      }
    });
    console.log('Sellers:', sellers);
  } catch (err) {
    console.error(err);
  } finally {
    await prisma.$disconnect();
  }
})();