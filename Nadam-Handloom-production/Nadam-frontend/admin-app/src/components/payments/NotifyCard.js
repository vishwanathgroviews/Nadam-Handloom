// "Get a notification for each online payment" (owners), until it is on for this phone.
import { useCallback, useState } from 'react';
import { Linking, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { Button } from '../Button';
import { Icon } from '../Icon';
import { T } from '../T';
import { useTheme } from '../../theme/ThemeProvider';
import { useFeedback } from '../Feedback';
import * as payments from '../../api/payments';
import * as push from '../../push/notifications';

export function NotifyCard({ style }) {
  const { c, radius } = useTheme();
  const { showToast } = useFeedback();
  const [state, setState] = useState(null); // null (checking) | on | off | blocked | unavailable
  const [busy, setBusy] = useState(false);

  const check = useCallback(async () => {
    try {
      const [{ push: s }, allowed] = await Promise.all([payments.pushStatus(), push.permission()]);
      if (!s.ready) setState('unavailable');
      else if (s.registered && s.payments && allowed === 'allowed') setState('on');
      else setState(allowed === 'blocked' ? 'blocked' : 'off');
    } catch { setState(null); }
  }, []);
  // Checked each time the screen comes into view (also after the phone's Settings).
  useFocusEffect(useCallback(() => { check(); }, [check]));

  async function turnOn() {
    if (state === 'blocked') { Linking.openSettings(); return; }
    setBusy(true);
    try {
      const r = await push.enable({ paymentsOn: true });
      if (r.ok) { setState('on'); showToast('Payment notifications are on for this phone'); }
      else if (r.reason === 'blocked') setState('blocked');
      else if (r.reason === 'unavailable') setState('unavailable');
    } catch (e) {
      showToast(e.message);
    } finally {
      setBusy(false);
    }
  }

  if (!state || state === 'on') return null;
  const text = state === 'blocked'
    ? 'Notifications for this app are off in the phone\'s Settings. Turn them on there to hear about each payment.'
    : state === 'unavailable'
      ? 'Notifications aren\'t available on this phone yet. They come with an app update.'
      : 'Get a notification on this phone for each online payment, and if a refund needs you.';
  return (
    <View style={[{ flexDirection: 'row', gap: 12, alignItems: 'center', padding: 14, borderRadius: radius.lg, backgroundColor: c.primarySoft, marginBottom: 12 }, style]}>
      <Icon name="message" size={22} color={c.primary} />
      <T variant="small" color="text2" style={{ flex: 1 }}>{text}</T>
      {state !== 'unavailable' ? <Button title={state === 'blocked' ? 'Settings' : 'Turn on'} small loading={busy} onPress={turnOn} /> : null}
    </View>
  );
}
