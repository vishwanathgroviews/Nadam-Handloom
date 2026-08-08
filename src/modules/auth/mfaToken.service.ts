import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'super_secret_jwt_key_please_change_in_production';
const MFA_TOKEN_EXPIRES_IN = '5m';

interface MfaTokenPayload {
  accountId: string;
  typ: 'mfa';
}

export const generateMfaToken = (accountId: string): string => {
  const payload: MfaTokenPayload = { accountId, typ: 'mfa' };
  return jwt.sign(payload, JWT_SECRET, { expiresIn: MFA_TOKEN_EXPIRES_IN });
};

export const verifyMfaToken = (token: string): string => {
  const decoded = jwt.verify(token, JWT_SECRET) as Partial<MfaTokenPayload>;
  if (decoded.typ !== 'mfa' || !decoded.accountId) {
    throw new Error('Invalid MFA token');
  }
  return decoded.accountId;
};
