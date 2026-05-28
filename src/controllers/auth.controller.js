const authService = require('../services/auth.service');
const { created, ok } = require('../utils/response');

async function register(req, res, next) {
    try {
        const result = await authService.register(req.body);
        return created(res, { message: 'Registered', data: result });
    } catch (err) {
        return next(err);
    }
}

async function clientRegister(req, res, next) {
    try {
        const result = await authService.clientRegister(req.body);
        return created(res, { message: 'Registered', data: result });
    } catch (err) {
        return next(err);
    }
}

async function login(req, res, next) {
    try {
        const result = await authService.login(req.body);
        return ok(res, { message: 'Logged in', data: result });
    } catch (err) {
        return next(err);
    }
}

async function clientLogin(req, res, next) {
    try {
        const result = await authService.clientLogin(req.body);
        return ok(res, { message: 'Logged in', data: result });
    } catch (err) {
        return next(err);
    }
}

async function verifyEmail(req, res, next) {
    try {
        const { token } = req.body;
        const result = await authService.verifyEmail(token);
        return ok(res, result);
    } catch (err) {
        return next(err);
    }
}

async function resendVerification(req, res, next) {
    try {
        const userId = req.user?.id || req.body.userId;
        const email = req.body.email;
        const result = await authService.resendVerification(userId, email);
        return ok(res, result);
    } catch (err) {
        return next(err);
    }
}

async function getMe(req, res, next) {
    try {
        const result = await authService.getMe(req.user.id);
        return ok(res, { message: 'Current user', data: result.user });
    } catch (err) {
        return next(err);
    }
}

async function updateMe(req, res, next) {
    try {
        const result = await authService.updateMe(req.user.id, {
            ...req.body,
            file: req.file
        });
        return ok(res, { message: 'Account updated', data: result.user });
    } catch (err) {
        return next(err);
    }
}

async function forgotPassword(req, res, next) {
    try {
        const { email } = req.body;
        const result = await authService.forgotPassword(email);
        return ok(res, result);
    } catch (err) {
        return next(err);
    }
}

async function resetPassword(req, res, next) {
    try {
        const { token, password } = req.body;
        const result = await authService.resetPassword(token, password);
        return ok(res, result);
    } catch (err) {
        return next(err);
    }
}

module.exports = {
    register,
    clientRegister,
    login,
    clientLogin,
    verifyEmail,
    resendVerification,
    forgotPassword,
    resetPassword,
    getMe,
    updateMe
};
