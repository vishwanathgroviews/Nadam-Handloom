// Change PIN while signed in (docs 4.7): current PIN -> new PIN -> confirm.
// Wrong current PINs count toward the lock.
import { useRef, useState } from 'react';
import { Keyboard, Switch, View } from 'react-native';
import { router } from 'expo-router';
import { Screen, TopBar } from '../../../components/Screen';
import { T } from '../../../components/T';
import { Button, LinkButton } from '../../../components/Button';
import { Banner } from '../../../components/Banner';
import { PinBoxes } from '../../../components/PinBoxes';
import { StepBar, RuleList } from '../../../components/Bits';
import { useFeedback } from '../../../components/Feedback';
import { useTheme } from '../../../theme/ThemeProvider';
import { api } from '../../../api/client';
import { session, useSession } from '../../../auth/session';
import { flowStore } from '../../../auth/flow';
import { pinRules, pinAllowed } from '../../../utils/pinRules';
import { useTabBarSpace } from '../../../hooks/useTabBarSpace';

export default function ChangePin() {
  const s = useSession();
  const { c } = useTheme();
  const { showToast } = useFeedback();
  const pinRef = useRef(null);
  const tabSpace = useTabBarSpace().footer;
  const [phase, setPhase] = useState('current');
  const [pin, setPin] = useState('');
  const [current, setCurrent] = useState('');
  const [first, setFirst] = useState('');
  const [changeToken, setChangeToken] = useState(null);
  const [others, setOthers] = useState(false);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const step = { current: 1, new: 2, confirm: 3 }[phase];

  async function next(value = pin) {
    if (value.length !== 6) return undefined;
    setError(null);
    if (phase === 'current') {
      setBusy(true);
      try {
        const res = await api('/me/pin/verify', { method: 'POST', body: { pin: value } });
        setChangeToken(res.changeToken);
        setCurrent(value);
        setPin('');
        setPhase('new');
      } catch (e) {
        setPin('');
        if (e.code === 'WRONG_PIN') { setError({ title: `That's not your current PIN. ${e.details.triesLeft} ${e.details.triesLeft === 1 ? 'try' : 'tries'} left.` }); pinRef.current?.shake(); }
        else if (e.code === 'LOCKED') {
          // Leave the signed-in screens first, then end the sign-in (the server already ended it).
          flowStore.reset({ lock: e.details, mobile: s.user?.mobile });
          router.replace('/locked');
          session.logout();
        } else setError({ title: e.message, tone: 'warning' });
      } finally {
        setBusy(false);
      }
      return undefined;
    }
    if (phase === 'new') {
      if (!pinAllowed(value, s.user?.mobile, { differentFrom: current })) { pinRef.current?.shake(); return undefined; }
      setFirst(value);
      setPin('');
      return setPhase('confirm');
    }
    if (value !== first) {
      setPin('');
      setFirst('');
      setPhase('new');
      return setError({ title: 'PINs don\'t match. Enter the new PIN again.' });
    }
    setBusy(true);
    try {
      const res = await api('/me/pin/change', { method: 'POST', body: { changeToken, newPin: value, signOutOthers: others } });
      Keyboard.dismiss();
      router.back();
      showToast(`PIN changed${res.devicesSignedOut ? ` · ${res.devicesSignedOut} other device${res.devicesSignedOut > 1 ? 's' : ''} signed out` : ''}`, 'success');
    } catch (e) {
      setPin('');
      if (e.code === 'STEP_EXPIRED') { setPhase('current'); setError({ title: 'This took too long. Enter your current PIN again.' }); }
      else if (e.code === 'SAME_AS_CURRENT' || e.code === 'WEAK_PIN') { setPhase('new'); setError({ title: e.message }); }
      else setError({ title: e.message, tone: 'warning' });
    } finally {
      setBusy(false);
    }
    return undefined;
  }

  const titles = { current: 'Enter your current PIN', new: 'Choose a new PIN', confirm: 'Type the new PIN again' };
  const labels = { current: 'Current PIN', new: 'New PIN', confirm: 'Confirm new PIN' };
  return (
    <Screen edges={['top']} top={<TopBar title="Change PIN" onBack={() => router.back()} />} maxWidth={620}
      footer={<View style={{ paddingBottom: tabSpace }}><Button title={phase === 'confirm' ? 'Save new PIN' : 'Continue'} loading={busy} disabled={pin.length !== 6} onPress={() => next()} /></View>}>
      <StepBar step={step} total={3} />
      <T variant="heading" style={{ marginBottom: 14 }}>{titles[phase]}</T>
      {error ? <Banner tone={error.tone || 'error'} title={error.title} style={{ marginBottom: 14 }} /> : null}
      <PinBoxes key={phase} ref={pinRef} label={labels[phase]} value={pin} onChange={setPin} onComplete={(v) => next(v)} error={!!error && !error.tone}
        rightTool={phase === 'current' ? <LinkButton title="Forgot it?" onPress={() => { flowStore.reset({ mobile: s.user?.mobile }); router.push('/forgot'); }} /> : null} />
      {phase === 'new' ? <RuleList rules={pinRules(pin, s.user?.mobile, { differentFrom: current })} /> : null}
      {phase === 'confirm' ? (
        <View style={{ flexDirection: 'row', gap: 12, alignItems: 'center', marginTop: 16 }}>
          <View style={{ flex: 1 }}>
            <T variant="bodyStrong">Also sign out my other devices</T>
            <T variant="small" color="muted">They'll need the new PIN and an SMS code to sign in again.</T>
          </View>
          <Switch value={others} onValueChange={setOthers} trackColor={{ true: c.success, false: c.surface3 }} accessibilityLabel="Also sign out my other devices" />
        </View>
      ) : null}
    </Screen>
  );
}
