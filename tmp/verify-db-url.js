require('dotenv').config({ path: 'backend/.env' });
require('../src/config/env');
console.log(process.env.DATABASE_URL);
