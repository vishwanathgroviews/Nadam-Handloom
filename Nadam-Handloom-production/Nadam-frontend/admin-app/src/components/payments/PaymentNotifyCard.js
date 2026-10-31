// More → Notifications (owners): "Payment notifications" on this phone, and a test.
import { useCallback, useEffect, useState } from 'react';
import { AppState, Linking, Switch } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { Card, Row } from '../Bits';
import { useTheme } from '../../theme/ThemeProvider';
import { useFeedback } from '../Feedback';
import * as payments from '../../api/payments';
import * as push from '../../push/notifications';

export function PaymentNotifyCard() {
  const { c } = useTheme();
  const { confirm, showToast } = useFeedback();
  const [s, setS] = useState(null); // { on, permission, ready }
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const [{ push: st }, permission] = await Promise.all([payments.pushStatus(), push.permission()]);
      setS({ on: st.registered && st.payments && permission === 'allowed', permission, ready: st.ready });
    } catch { setS((x) => x || { on: false, permission: 'ask', ready: true }); }
  }, []);
  // Checked each time the screen comes into view (also after the phone's Settings).
  useFocusEffect(useCallback(() => { load(); }, [load]));
  // Back from the phone's Settings: check again.
  useEffect(() => {
    const sub = AppState.addEventListener('change', (st) => { if (st === 'active') load(); });
    return () => sub.remove();
  }, [load]);

  async function toggle(on) {
    setBusy(true);
    try {
      if (!on) {
        await payments.setPaymentPush(false);
        setS((x) => ({ ...x, on: false }));
        showToast('Payment notifications off on this phone');
        return;
      }
      const r = await push.enable({ paymentsOn: true });
      if (r.ok) {
        if (!r.push.payments) await payments.setPaymentPush(true);
        setS((x) => ({ ...x, on: true, permission: 'allowed' }));
        showToast('Payment notifications on for this phone');
      } else if (r.reason === 'blocked') {
        confirm({
          icon: 'message', title: 'Notifications are off for this app',
          text: 'Turn them on in the phone\'s Settings, then come back here.',
          actions: [{ label: 'Open Settings', kind: 'primary', onPress: () => Linking.openSettings() }, { label: 'Not now' }],
        });
      } else if (r.reason === 'unavailable') {
        showToast('Notifications aren\'t available on this phone yet.');
      }
    } catch (e) {
      showToast(e.message);
    } finally {
      setBusy(false);
    }
  }

  async function test() {
    setBusy(true);
    try {
      await payments.testPush();
      showToast('Sent. It should arrive in a few seconds.');
    } catch (e) {
      showToast(e.message);
    } finally {
      setBusy(false);
    }
  }

  const subtitle = !s ? 'Checking…'
    : !s.ready ? 'Not available on this phone yet: comes with an app update'
      : s.permission === 'blocked' ? 'Off in the phone\'s Settings'
        : s.on ? 'A notification for each online payment and refund' : 'Off on this phone';
  return (
    <Card>
      <Row icon="message" title="Payment notifications" subtitle={subtitle} last={!s?.on}
        right={<Switch value={!!s?.on} disabled={!s || !s.ready || busy} onValueChange={toggle} trackColor={{ true: c.success, false: c.surface3 }} accessibilityLabel="Payment notifications" />} />
      {s?.on ? <Row icon="send" title="Send a test notification" subtitle="To this phone" onPress={busy ? undefined : test} last /> : null}
    </Card>
  );
}
