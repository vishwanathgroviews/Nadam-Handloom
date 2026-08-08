import { randomBytes, createHash, randomUUID } from 'crypto';
import { prisma } from '../../config/prisma';
import { AuthService } from './auth.service';
import { revokeAllSessionsForAccount } from './session.service';

const RESET_TOKEN_TTL_MS = 60 * 60 * 1000; // 1 hour

const hashToken = (token: string): string => createHash('sha256').update(token).digest('hex');

export const generateResetToken = async (authAccountId: string): Promise<string> => {
  const rawToken = randomBytes(32).toString('base64url');
  const tokenHash = hashToken(rawToken);

  await prisma.passwordResetToken.create({
    data: {
      authAccountId,
      tokenHash,
      expiresAt: new Date(Date.now() + RESET_TOKEN_TTL_MS),
    },
  });

  return rawToken;
};

export const validateResetToken = async (rawToken: string) => {
  const tokenHash = hashToken(rawToken);
  const tokenRow = await prisma.passwordResetToken.findUnique({ where: { tokenHash } });

  if (!tokenRow || tokenRow.used || tokenRow.expiresAt < new Date()) {
    return null;
  }

  return tokenRow;
};

export const consumeResetTokenAndSetPassword = async (
  tokenRow: { id: string; authAccountId: string },
  newPassword: string
): Promise<void> => {
  const passwordHash = await AuthService.hashPassword(newPassword);
  const now = new Date();

  await prisma.$transaction(async (tx) => {
    await tx.authAccount.update({
      where: { id: tokenRow.authAccountId },
      data: {
        passwordHash,
        passwordChangedAt: now,
        securityStamp: randomUUID(),
      },
    });

    await tx.passwordResetToken.update({
      where: { id: tokenRow.id },
      data: { used: true, usedAt: now },
    });
  });

  await revokeAllSessionsForAccount(tokenRow.authAccountId);
};
