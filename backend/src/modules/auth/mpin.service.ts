import { randomUUID } from 'crypto';
import { prisma } from '../../config/prisma';
import { hashSecret, verifySecret } from '../../utils/hash';
import { revokeAllSessionsForAccount } from './session.service';

export const setMpin = async (authAccountId: string, mpin: string): Promise<void> => {
  const mpinHash = await hashSecret(mpin);
  await prisma.authAccount.update({
    where: { id: authAccountId },
    data: { mpinHash, mpinSetAt: new Date(), status: 'active' },
  });
};

export const resetMpin = async (authAccountId: string, mpin: string): Promise<void> => {
  const mpinHash = await hashSecret(mpin);
  await prisma.authAccount.update({
    where: { id: authAccountId },
    data: {
      mpinHash,
      mpinSetAt: new Date(),
      securityStamp: randomUUID(),
      failedLoginAttempts: 0,
      lockedUntil: null,
    },
  });
  await revokeAllSessionsForAccount(authAccountId);
};

export const verifyMpin = async (mpinHash: string, mpin: string): Promise<boolean> => {
  return verifySecret(mpinHash, mpin);
};
