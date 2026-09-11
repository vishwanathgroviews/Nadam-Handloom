import { Expo, ExpoPushMessage } from 'expo-server-sdk';
import { prisma } from '../../config/prisma';
import { BadRequestError } from '../../utils/errors';

const expo = new Expo();

export const registerDevice = async (authAccountId: string, expoPushToken: string, platform: 'ios' | 'android') => {
  if (!Expo.isExpoPushToken(expoPushToken)) {
    throw new BadRequestError('Invalid Expo push token');
  }
  await prisma.deviceToken.upsert({
    where: { expoPushToken },
    update: { authAccountId, platform },
    create: { authAccountId, expoPushToken, platform },
  });
};

export const unregisterDevice = async (expoPushToken: string) => {
  await prisma.deviceToken.deleteMany({ where: { expoPushToken } });
};

/** Pushes to every registered device belonging to an account with any of these roles. */
export const sendPushToRoles = async (
  roles: string[],
  title: string,
  body: string,
  data?: Record<string, unknown>
): Promise<void> => {
  const userRoles = await prisma.userRole.findMany({
    where: { role: { name: { in: roles } } },
    select: { authAccountId: true },
  });
  const accountIds = [...new Set(userRoles.map((r) => r.authAccountId))];
  if (!accountIds.length) return;

  const tokens = await prisma.deviceToken.findMany({ where: { authAccountId: { in: accountIds } } });
  const valid = tokens.filter((t) => Expo.isExpoPushToken(t.expoPushToken));
  if (!valid.length) return;

  const messages: ExpoPushMessage[] = valid.map((t) => ({
    to: t.expoPushToken,
    sound: 'default',
    title,
    body,
    data: data ?? {},
  }));

  // Deliberately not caught here: a send failure must propagate to the
  // caller (the outbox dispatcher) so the event stays undispatched and
  // retries on the next sweep, instead of being silently marked delivered.
  const chunks = expo.chunkPushNotifications(messages);
  let tokenIndex = 0;
  for (const chunk of chunks) {
    const tickets = await expo.sendPushNotificationsAsync(chunk);
    for (const ticket of tickets) {
      const token = valid[tokenIndex]!.expoPushToken;
      tokenIndex += 1;
      if (ticket.status === 'error' && ticket.details?.error === 'DeviceNotRegistered') {
        await prisma.deviceToken.deleteMany({ where: { expoPushToken: token } });
      }
    }
  }
};
