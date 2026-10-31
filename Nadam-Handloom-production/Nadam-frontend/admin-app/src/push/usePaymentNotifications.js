// Owners' phones: keeps the notification token on the server fresh (only once notifications
// are allowed; never asks here), and opens the payment a tapped notification is about,
// also when the tap started the app or came before signing in.
import { useEffect, useRef } from 'react';
import { router } from 'expo-router';
import * as Notifications from 'expo-notifications';
import { can, PERMISSION } from '../auth/permissions';
import { numberFromData } from '../utils/payments';
import * as push from './notifications';

export function usePaymentNotifications(user, signedIn) {
  const owner = signedIn && can(user, PERMISSION.PAYMENTS_VIEW);
  useEffect(() => {
    if (!owner) return undefined;
    push.permission().then((p) => { if (p === 'allowed') push.enable({ ask: false }).catch(() => {}); }).catch(() => {});
    return push.watchToken();
  }, [owner]);

  const last = Notifications.useLastNotificationResponse();
  const handled = useRef(null);
  useEffect(() => {
    if (!owner || !last || last.actionIdentifier !== Notifications.DEFAULT_ACTION_IDENTIFIER) return;
    const id = last.notification.request.identifier;
    if (handled.current === id) return;
    handled.current = id;
    const n = numberFromData(last.notification.request.content.data);
    if (n) router.push(`/more/payments/${n}`);
    Notifications.clearLastNotificationResponse();
  }, [last, owner]);
}
