const router = require('express').Router();
const userController = require('../controllers/user.controller');
const auth = require('../middlewares/auth.middleware');
const requireAdmin = require('../middlewares/admin.middleware');
const validate = require('../middlewares/validate.middleware');
const { z } = require('zod');

// Admin: List all users
router.get(
    '/',
    auth,
    requireAdmin,
    userController.listUsers
);

// Admin: Update user
router.patch(
    '/:userId',
    auth,
    requireAdmin,
    validate(
        z.object({
            body: z.object({
                type: z.enum(['INDIVIDUAL', 'SHOP', 'ADMIN']).optional(),
                isActive: z.boolean().optional()
            })
        })
    ),
    userController.updateUser
);

// Admin: Delete user
router.delete(
    '/:userId',
    auth,
    requireAdmin,
    userController.deleteUser
);

module.exports = router;
