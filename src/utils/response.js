function ok(res, { message = 'OK', data = null, meta = null } = {}) {
    return res.status(200).json({ success: true, message, data, meta });
}

function created(res, { message = 'Created', data = null, meta = null } = {}) {
    return res.status(201).json({ success: true, message, data, meta });
}

function fail(res, { statusCode = 400, message = 'Bad Request', errors = null } = {}) {
    return res.status(statusCode).json({ success: false, message, errors });
}

module.exports = { ok, created, fail };
