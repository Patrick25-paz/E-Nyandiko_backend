const { Resend } = require('resend');
const env = require('../config/env');
const logger = require('./logger');

const resend = env.RESEND_EMAIL_API_KEY ? new Resend(env.RESEND_EMAIL_API_KEY) : null;

async function sendEmail({ to, subject, html }) {
    if (!resend) {
        logger.warn('Resend API key not configured. Email not sent.');
        logger.info(`Email details: To: ${to}, Subject: ${subject}, Content: ${html}`);
        return;
    }

    try {
        const { data, error } = await resend.emails.send({
            from: env.RESEND_FROM_EMAIL || 'E-Nyandiko <noreply@enyandiko.com>',
            to,
            subject,
            html
        });

        if (error) {
            logger.error('Error sending email through Resend:', error);
            throw error;
        }

        return data;
    } catch (err) {
        logger.error('Failed to send email:', err);
        throw err;
    }
}

async function sendVerificationEmail(email, code) {
    const html = `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 8px;">
            <h1 style="color: #1e293b; text-align: center;">Verify your Email</h1>
            <p style="color: #475569; font-size: 16px; line-height: 1.5;">Thank you for registering with E-Nyandiko. Please use the following code to verify your account:</p>
            <div style="background-color: #f8fafc; border: 1px dashed #cbd5e1; border-radius: 6px; padding: 20px; text-align: center; margin: 30px 0;">
                <span style="font-size: 32px; font-weight: bold; letter-spacing: 5px; color: #2563eb;">${code}</span>
            </div>
            <p style="color: #64748b; font-size: 14px;">If you did not request this, please ignore this email.</p>
        </div>
    `;

    return sendEmail({ to: email, subject: `${code} is your E-Nyandiko verification code`, html });
}

async function sendPasswordResetEmail(email, token) {
    const resetUrl = `${env.FRONTEND_URL}/reset-password?token=${token}`;
    const html = `
        <h1>Password Reset Request</h1>
        <p>You requested to reset your password. Please click the link below to set a new password:</p>
        <a href="${resetUrl}">${resetUrl}</a>
        <p>This link will expire in 1 hour.</p>
        <p>If you did not request this, please ignore this email.</p>
    `;

    return sendEmail({ to: email, subject: 'Reset your E-Nyandiko password', html });
}

async function sendAgreementApprovalEmail({ to, agreementId, sellerName, approvalUrl }) {
    const safeSeller = sellerName ? String(sellerName) : 'the seller';
    const html = `
        <div style="font-family: sans-serif; max-width: 650px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 8px;">
            <h1 style="color: #0f172a; margin: 0 0 12px;">Agreement approval</h1>
            <p style="color: #334155; font-size: 15px; line-height: 1.6; margin: 0 0 16px;">
                ${safeSeller} has created an agreement for you. You can open it and approve it using the link below (no login required).
            </p>
            <div style="margin: 18px 0;">
                <a href="${approvalUrl}" style="display: inline-block; background: #2563eb; color: white; padding: 12px 16px; border-radius: 8px; text-decoration: none; font-weight: 600;">
                    View & Approve Agreement
                </a>
            </div>
            <p style="color: #64748b; font-size: 12px; line-height: 1.5; margin: 0;">
                Agreement ID: ${agreementId}
            </p>
            <p style="color: #64748b; font-size: 12px; line-height: 1.5; margin: 10px 0 0;">
                If you did not expect this email, you can ignore it.
            </p>
        </div>
    `;

    return sendEmail({
        to,
        subject: 'Approve your E-Nyandiko agreement',
        html
    });
}

module.exports = {
    sendEmail,
    sendVerificationEmail,
    sendPasswordResetEmail,
    sendAgreementApprovalEmail
};
