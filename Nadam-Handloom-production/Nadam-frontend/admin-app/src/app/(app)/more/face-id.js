// Turn on Face ID / fingerprint from My account (16 Oct 2026): the PIN first, so a copied
// sign-in key alone can't add someone else's face. Wrong PINs count toward the lock.
import { useRef, useState } from 'react';
import { Keyboard, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Screen, TopBar } from '../../../components/Screen';
import { T } from '../../../components/T';
import { Button, LinkButton } from '../../../components/Button';
import { Banner } from '../../../components/Banner';
import { PinBoxes } from '../../../components/PinBoxes';
import { useFeedback } from '../../../components/Feedback';
import { api } from '../../../api/client';
import { session, useSession } from '../../../auth/session';
import { flowStore } from '../../../auth/flow';
import { enableBiometric } from '../../../auth/biometrics';
import { useTabBarSpace } from '../../../hooks/useTabBarSpace';

export default function TurnOnFaceId() {
  const s = useSession();
  const { label = 'Face ID' } = useLocalSearchParams();
  const { showToast } = useFeedback();
  const pinRef = useRef(null);
  const tabSpace = useTabBarSpace().footer;
  const [pin, setPin] = useState('');
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  async function turnOn(value = pin) {
    if (value.length !== 6 || busy) return;
    setBusy(true);
    setError(null);
    try {
      // The PIN is checked before the face or fingerprint prompt, so a typo is caught first.
      await api('/me/pin/verify', { method: 'POST', body: { pin: value } });
      await enableBiometric({ accountId: s.user.id, label, pin: value });
      Keyboard.dismiss();
      router.back();
      showToast(`${label} turned on`, 'success');
    } catch (e) {
      setPin('');
      if (e.code === 'WRONG_PIN') {
        setError({ title: `That's not your PIN. ${e.details.triesLeft} ${e.details.triesLeft === 1 ? 'try' : 'tries'} left.` });
        pinRef.current?.shake();
      } else if (e.code === 'LOCKED') {
        // Leave the signed-in screens first, then end the sign-in (the server already ended it).
        flowStore.reset({ lock: e.details, mobile: s.user?.mobile });
        router.replace('/locked');
        session.logout();
      } else if (e.code === 'CANCELLED' || e.code === 'FALLBACK') {
        setError({ tone: 'info', title: `${label} wasn't turned on`, text: 'Enter your PIN to try again.' });
      } else if (e.code === 'NOT_ENROLLED') {
        setError({ tone: 'warning', title: `${label} isn't set up on this phone`, text: 'Set it up in the phone\'s Settings first.' });
      } else {
        setError({ tone: 'warning', title: `Couldn't turn on ${label}`, text: e.message });
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen edges={['top']} top={<TopBar title={`Turn on ${label}`} onBack={() => router.back()} />} maxWidth={620}
      footer={<View style={{ paddingBottom: tabSpace }}><Button title="Continue" loading={busy} disabled={pin.length !== 6} onPress={() => turnOn()} /></View>}>
      <T variant="heading" style={{ marginBottom: 6 }}>Enter your PIN</T>
      <T color="text2" style={{ marginBottom: 14 }}>To keep your account safe, {label} is turned on only with your PIN.</T>
      {error ? <Banner tone={error.tone || 'error'} title={error.title} text={error.text} style={{ marginBottom: 14 }} /> : null}
      <PinBoxes ref={pinRef} label="Your PIN" value={pin} onChange={setPin} onComplete={(v) => turnOn(v)} error={!!error && !error.tone}
        rightTool={<LinkButton title="Forgot it?" onPress={() => { flowStore.reset({ mobile: s.user?.mobile }); router.push('/forgot'); }} />} />
    </Screen>
  );
}
