import jwt from 'jsonwebtoken';
import { randomBytes, createHash } from 'crypto';

const JWT_SECRET = process.env.JWT_SECRET || 'super_secret_jwt_key_please_change_in_production';

// 15 minutes for Access Token
const ACCESS_TOKEN_EXPIRES_IN = '15m';

export const generateAccessToken = (payload: object) => {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: ACCESS_TOKEN_EXPIRES_IN });
};

export const verifyAccessToken = (token: string) => {
  return jwt.verify(token, JWT_SECRET);
};

export const generateRefreshToken = () => {
  const token = randomBytes(64).toString('base64');
  const hash = createHash('sha256').update(token).digest('hex');
  
  // Return the raw token to send via HTTP-only cookie, and the hash to store in DB
  return { token, hash };
};

export const hashRefreshToken = (token: string) => {
    return createHash('sha256').update(token).digest('hex');
}
