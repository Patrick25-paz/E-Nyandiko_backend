const router = require('express').Router();

const authController = require('../controllers/auth.controller');
const validate = require('../middlewares/validate.middleware');
const auth = require('../middlewares/auth.middleware');
const upload = require('../middlewares/upload.middleware');
const {
    registerSchema,
    clientRegisterSchema,
    loginSchema,
    clientLoginSchema,
    verifyEmailSchema,
    forgotPasswordSchema,
    resetPasswordSchema,
    resendVerificationSchema,
    updateMeSchema
} = require('../validators/auth.validator');

router.post('/register', validate(registerSchema), authController.register);
router.post('/client/register', validate(clientRegisterSchema), authController.clientRegister);
router.post('/login', validate(loginSchema), authController.login);
router.post('/client/login', validate(clientLoginSchema), authController.clientLogin);

router.post('/verify-email', validate(verifyEmailSchema), authController.verifyEmail);
router.post('/forgot-password', validate(forgotPasswordSchema), authController.forgotPassword);
router.post('/reset-password', validate(resetPasswordSchema), authController.resetPassword);
router.post('/resend-verification', validate(resendVerificationSchema), authController.resendVerification);

router.get('/me', auth, authController.getMe);
router.patch('/me', auth, upload.single('profileImage'), validate(updateMeSchema), authController.updateMe);

module.exports = router;
