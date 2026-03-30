const router = require('express').Router();

router.get('/health', (req, res) => {
    res.json({ success: true, message: 'OK', data: { uptime: process.uptime() } });
});

module.exports = router;
