"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.sendPasswordResetEmail = exports.sendInviteEmail = exports.sendOtpEmail = exports.sendEmail = void 0;
const client_ses_1 = require("@aws-sdk/client-ses");
const sesClient = new client_ses_1.SESClient({
    region: process.env.AWS_REGION || 'us-east-1',
});
const mockConsoleEmail = (label, to, body) => {
    console.log(`\n==================================================`);
    console.log(`📩 [${label}] To: ${to}`);
    console.log(body);
    console.log(`==================================================\n`);
};
const sendEmail = async (to, subject, body) => {
    const senderEmail = process.env.AWS_SES_FROM_EMAIL;
    if (!senderEmail || process.env.ENABLE_MOCK_AWS === 'true') {
        mockConsoleEmail('MOCK EMAIL SERVICE', to, body);
        return;
    }
    const params = {
        Destination: { ToAddresses: [to] },
        Message: {
            Body: { Text: { Charset: 'UTF-8', Data: body } },
            Subject: { Charset: 'UTF-8', Data: subject },
        },
        Source: senderEmail,
    };
    try {
        await sesClient.send(new client_ses_1.SendEmailCommand(params));
        console.log(`✅ Email sent successfully via AWS SES to ${to}`);
    }
    catch (error) {
        console.warn(`⚠️ AWS SES email sending failed (${error.message}). Falling back to console mock output:`);
        mockConsoleEmail('FALLBACK MOCK EMAIL', to, body);
    }
};
exports.sendEmail = sendEmail;
const sendOtpEmail = async (email, code) => {
    await (0, exports.sendEmail)(email, 'Your OTP Verification Code', `Your verification code is: ${code}. It will expire in 5 minutes.`);
};
exports.sendOtpEmail = sendOtpEmail;
const sendInviteEmail = async (email, resetToken) => {
    const resetUrl = `${process.env.APP_BASE_URL || 'http://localhost:3001'}/password-reset?token=${resetToken}`;
    await (0, exports.sendEmail)(email, 'You have been invited', `An account has been created for you. Set your password here: ${resetUrl}. This link expires in 1 hour.`);
};
exports.sendInviteEmail = sendInviteEmail;
const sendPasswordResetEmail = async (email, resetToken) => {
    const resetUrl = `${process.env.APP_BASE_URL || 'http://localhost:3001'}/password-reset?token=${resetToken}`;
    await (0, exports.sendEmail)(email, 'Password Reset Request', `We received a request to reset your password. Reset it here: ${resetUrl}. This link expires in 1 hour. If you didn't request this, you can ignore this email.`);
};
exports.sendPasswordResetEmail = sendPasswordResetEmail;
//# sourceMappingURL=email.service.js.map