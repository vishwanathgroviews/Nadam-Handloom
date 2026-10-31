// Create / choose / upgrade a PIN (setup step 3, Forgot PIN step 3, 4-digit upgrade).
// Typed twice; the same rules as the server, shown live.
import { useRef, useState } from 'react';
import { Keyboard } from 'react-native';
import { Redirect, router, useLocalSearchParams } from 'expo-router';
import { AuthLayout } from '../../components/AuthLayout';
import { T } from '../../components/T';
import { Button } from '../../components/Button';
import { Banner } from '../../components/Banner';
import { PinBoxes } from '../../components/PinBoxes';
import { StepBar, RuleList } from '../../components/Bits';
import { useFeedback } from '../../components/Feedback';
import { publicApi } from '../../api/client';
import { useFlow, flowStore } from '../../auth/flow';
import { getDeviceInfo } from '../../auth/device';
import { session } from '../../auth/session';
import { getBiometricStatus } from '../../auth/biometrics';
import { pinRules, pinAllowed } from '../../utils/pinRules';

const TITLES = { setup: 'Create your PIN', reset: 'Choose a new PIN', upgrade: 'Set a 6-digit PIN' };

export default function SetPin() {
  const { purpose = 'setup' } = useLocalSearchParams();
  const f = useFlow();
  const { confirm, showToast } = useFeedback();
  const pinRef = useRef(null);
  const [phase, setPhase] = useState('create');
  const [first, setFirst] = useState('');
  const [pin, setPin] = useState('');
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  if (!f.stepToken || !TITLES[purpose]) return <Redirect href="/sign-in" />;

  const confirming = phase === 'confirm';

  async function next(value = pin) {
    if (value.length !== 6) return undefined;
    if (!confirming) {
      if (!pinAllowed(value, f.mobile)) {
        pinRef.current?.shake();
        return undefined;
      }
      setFirst(value);
      setPin('');
      setError(null);
      return setPhase('confirm');
    }
    if (value !== first) {
      setPhase('create');
      setFirst('');
      setPin('');
      return setError({ title: 'PINs don\'t match. Enter the new PIN again.' });
    }
    setBusy(true);
    try {
      const device = await getDeviceInfo();
      const res = await publicApi('/auth/pin/set', { method: 'POST', body: { stepToken: f.stepToken, pin: value, device } });
      Keyboard.dismiss();
      await session.applySignIn(res);
      if (purpose === 'setup') {
        const bio = await getBiometricStatus();
        // The PIN just chosen, in memory only, for "Turn on Face ID" on the next screen
        // (the server asks for it); dropped there or after 10 minutes.
        if (bio.available) flowStore.set({ pinForBiometric: { pin: value, at: Date.now() } });
        router.replace(bio.available ? '/biometric-setup' : '/done');
      } else if (purpose === 'reset') {
        flowStore.set({ othersSignedOut: res.othersSignedOut ?? 0 });
        router.replace('/reset-done');
      } else {
        router.replace('/home');
        showToast('PIN updated to 6 digits', 'success');
      }
    } catch (e) {
      setPhase('create');
      setFirst('');
      setPin('');
      if (e.code === 'STEP_EXPIRED') setError({ title: 'This step timed out', text: 'For safety, finish within 10 minutes of the SMS code. Please start again.', restart: true });
      else if (e.code === 'WEAK_PIN') setError({ title: e.message });
      else setError({ title: e.code === 'NETWORK' ? 'Can\'t reach the server' : 'Couldn\'t save the PIN', text: e.message, tone: 'warning' });
    } finally {
      setBusy(false);
    }
    return undefined;
  }

  function back() {
    if (confirming) {
      setPhase('create');
      setFirst('');
      return setPin('');
    }
    if (purpose === 'upgrade') return router.replace('/sign-in');
    return confirm({
      tone: 'warning', icon: 'alert', title: 'Leave without a PIN?', text: 'To start again you\'ll need a new SMS code.',
      actions: [{ label: 'Stay and finish', kind: 'primary' }, { label: 'Leave', kind: 'danger', onPress: () => router.replace('/sign-in') }],
    });
  }

  return (
    <AuthLayout onBack={back} footer={<Button title={confirming ? 'Save PIN' : 'Continue'} loading={busy} disabled={pin.length !== 6} onPress={() => next()} />}>
      {purpose === 'setup' ? <StepBar step={3} total={4} /> : purpose === 'reset' ? <StepBar step={3} total={3} /> : null}
      <T variant="title">{confirming ? 'Type it again' : TITLES[purpose]}</T>
      <T color="text2" style={{ marginTop: 6, marginBottom: 16 }}>
        {confirming ? 'Enter the same 6 digits again to confirm.' : purpose === 'upgrade' ? '' : 'You\'ll use this PIN to sign in on this phone and on any new phone.'}
      </T>
      {purpose === 'upgrade' && !confirming ? <Banner tone="info" title="PINs are now 6 digits" text="Your old 4-digit PIN worked this time. Set a 6-digit PIN to continue. It takes 10 seconds." style={{ marginBottom: 16 }} /> : null}
      {error ? <Banner tone={error.tone || 'error'} title={error.title} text={error.text} style={{ marginBottom: 16 }} /> : null}
      <PinBoxes key={phase} ref={pinRef} label={confirming ? 'Confirm PIN' : 'New PIN'} value={pin} onChange={setPin} onComplete={(v) => next(v)} error={!!error && !error.tone} />
      {!confirming ? <RuleList rules={pinRules(pin, f.mobile)} /> : null}
      {error?.restart ? <Button title="Start again" kind="secondary" style={{ marginTop: 16 }} onPress={() => router.replace(purpose === 'reset' ? '/forgot' : purpose === 'upgrade' ? '/sign-in' : '/setup')} /> : null}
    </AuthLayout>
  );
}
