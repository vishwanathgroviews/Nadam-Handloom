import { createHash, randomInt } from 'crypto';

export const generateOtp = (): string => {
  return randomInt(100000, 999999).toString();
};

export const hashOtp = (code: string): string => {
  return createHash('sha256').update(code).digest('hex');
};
