import { SESClient, SendEmailCommand } from '@aws-sdk/client-ses';

const sesClient = new SESClient({
  region: process.env.AWS_REGION || 'us-east-1',
});

const mockConsoleEmail = (label: string, to: string, body: string) => {
  console.log(`\n==================================================`);
  console.log(`📩 [${label}] To: ${to}`);
  console.log(body);
  console.log(`==================================================\n`);
};

export const sendEmail = async (to: string, subject: string, body: string): Promise<void> => {
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
    await sesClient.send(new SendEmailCommand(params));
    console.log(`✅ Email sent successfully via AWS SES to ${to}`);
  } catch (error: any) {
    console.warn(`⚠️ AWS SES email sending failed (${error.message}). Falling back to console mock output:`);
    mockConsoleEmail('FALLBACK MOCK EMAIL', to, body);
  }
};

export const sendOtpEmail = async (email: string, code: string): Promise<void> => {
  await sendEmail(
    email,
    'Your OTP Verification Code',
    `Your verification code is: ${code}. It will expire in 5 minutes.`
  );
};

export const sendInviteEmail = async (email: string, resetToken: string): Promise<void> => {
  const resetUrl = `${process.env.APP_BASE_URL || 'http://localhost:3001'}/password-reset?token=${resetToken}`;
  await sendEmail(
    email,
    'You have been invited',
    `An account has been created for you. Set your password here: ${resetUrl}. This link expires in 1 hour.`
  );
};

export const sendPasswordResetEmail = async (email: string, resetToken: string): Promise<void> => {
  const resetUrl = `${process.env.APP_BASE_URL || 'http://localhost:3001'}/password-reset?token=${resetToken}`;
  await sendEmail(
    email,
    'Password Reset Request',
    `We received a request to reset your password. Reset it here: ${resetUrl}. This link expires in 1 hour. If you didn't request this, you can ignore this email.`
  );
};
