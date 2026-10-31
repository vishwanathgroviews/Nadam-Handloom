// Setup step 4 (optional): turn on Face ID / Touch ID / fingerprint for this phone.
import { useEffect, useState } from 'react';
import { router } from 'expo-router';
import { AuthLayout } from '../../components/AuthLayout';
import { T } from '../../components/T';
import { Button } from '../../components/Button';
import { Banner } from '../../components/Banner';
import { StepBar, MessageIcon, Facts } from '../../components/Bits';
import { useSession } from '../../auth/session';
import { flowStore } from '../../auth/flow';
import { getBiometricStatus, enableBiometric } from '../../auth/biometrics';

const PIN_KEPT_MS = 10 * 60 * 1000;
// The PIN chosen on the previous screen, if still fresh (memory only).
function chosenPin() {
  const p = flowStore.get().pinForBiometric;
  return p && Date.now() - p.at < PIN_KEPT_MS ? p.pin : undefined;
}
const forgetPin = () => flowStore.set({ pinForBiometric: undefined });

export default function BiometricSetup() {
  const s = useSession();
  const [bio, setBio] = useState({ label: 'Face ID', type: 'faceId', available: true });
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState(null);
  useEffect(() => { getBiometricStatus().then(setBio); }, []);
  const isFinger = bio.type === 'fingerprint';

  async function turnOn() {
    setBusy(true);
    setProblem(null);
    try {
      const pin = chosenPin();
      if (!pin) {
        // Too long since the PIN was chosen: turn it on from My account instead (it asks for the PIN).
        forgetPin();
        router.replace('/done');
        return;
      }
      await enableBiometric({ accountId: s.user.id, label: bio.label, pin });
      forgetPin();
      router.replace({ pathname: '/done', params: { bio: '1' } });
    } catch (e) {
      if (e.code === 'CANCELLED' || e.code === 'FALLBACK') setProblem({ tone: 'info', title: `${bio.label} wasn't turned on`, text: 'You can try again, or skip for now.' });
      else if (e.code === 'NOT_ENROLLED') setProblem({ tone: 'warning', title: `${bio.label} isn't set up on this phone`, text: 'Set it up in the phone\'s Settings, or skip for now.' });
      else setProblem({ tone: 'warning', title: `Couldn't turn on ${bio.label}`, text: e.message });
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthLayout footer={<>
      <Button title={`Turn on ${bio.label}`} loading={busy} disabled={!bio.available} onPress={turnOn} />
      <Button title="Not now" kind="ghost" onPress={() => { forgetPin(); router.replace('/done'); }} />
    </>}>
      <StepBar step={4} total={4} />
      <MessageIcon name={isFinger ? 'finger' : 'faceid'} />
      <T variant="title" style={{ textAlign: 'center' }}>Sign in faster with {bio.label}</T>
      <T color="text2" style={{ textAlign: 'center', marginTop: 8, marginBottom: 18 }}>
        Next time, just {isFinger ? 'touch the sensor' : 'look at the phone'} instead of typing your PIN.
      </T>
      {problem ? <Banner tone={problem.tone} title={problem.title} text={problem.text} style={{ marginBottom: 14 }} /> : null}
      {!bio.available ? <Banner tone="warning" title={`${bio.label} isn't available`} text="Set it up in the phone's Settings, or skip for now." style={{ marginBottom: 14 }} /> : null}
      <Facts items={[`Your ${isFinger ? 'fingerprint' : 'face'} stays on this phone. It is never sent to us.`, 'Your PIN still works any time', 'Turn it off any time in My account']} />
    </AuthLayout>
  );
}
