const pino = require('pino');

const logger = pino({
    level: process.env.NODE_ENV === 'development' ? 'debug' : 'info',
    redact: {
        paths: ['req.headers.authorization', 'password', '*.password', 'passwordHash'],
        remove: true
    }
});

module.exports = logger;
