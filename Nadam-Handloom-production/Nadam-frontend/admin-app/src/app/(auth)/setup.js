// First-time setup, step 1 (docs 4.1): the mobile number the owner invited.
// The reply is the same whether or not the number is invited.
import { useState } from 'react';
import { router } from 'expo-router';
import { AuthLayout } from '../../components/AuthLayout';
import { T } from '../../components/T';
import { Button } from '../../components/Button';
import { Banner } from '../../components/Banner';
import { MobileField } from '../../components/MobileField';
import { StepBar } from '../../components/Bits';
import { flowStore } from '../../auth/flow';
import { requestCode } from '../../auth/codeRequests';
import { mobileError } from '../../utils/phone';
import { mmss } from '../../utils/time';

export default function Setup() {
  const [mobile, setMobile] = useState(flowStore.get().mobile || '');
  const [err, setErr] = useState(null);
  const [banner, setBanner] = useState(null);
  const [busy, setBusy] = useState(false);

  async function send() {
    const e = mobileError(mobile);
    if (e) return setErr(e);
    setErr(null);
    setBanner(null);
    setBusy(true);
    flowStore.reset({ mobile });
    try {
      await requestCode('setup');
      router.push('/code');
    } catch (x) {
      if (x.code === 'CODE_RESEND_WAIT') setBanner({ tone: 'warning', title: 'A code was sent a moment ago', text: `Use that code, or wait ${mmss(x.details.retryAfterSeconds * 1000)} for a new one.`, canContinue: true });
      else if (x.code === 'CODE_TOO_MANY') setBanner({ tone: 'error', title: 'Too many codes requested', text: 'For safety, try again after 1 hour.' });
      else if (x.code === 'VALIDATION_FAILED') setErr(x.message);
      else setBanner({ tone: 'warning', title: x.code === 'NETWORK' ? 'Can\'t reach the server' : 'Couldn\'t send the code', text: x.message });
    } finally {
      setBusy(false);
    }
    return undefined;
  }

  return (
    <AuthLayout onBack={() => router.back()} footer={<>
      <Button title="Send code" loading={busy} onPress={send} />
      {banner?.canContinue ? <Button title="I have a code" kind="secondary" onPress={() => { flowStore.set({ purpose: 'setup', expiresAt: Date.now() + 30000, resendAt: Date.now() + 30000 }); router.push('/code'); }} /> : null}
      <Button title="Already set up? Sign in" kind="ghost" onPress={() => router.replace('/sign-in')} />
    </>}>
      <StepBar step={1} total={4} />
      <T variant="title">Set up your account</T>
      <T color="text2" style={{ marginTop: 6, marginBottom: 20 }}>Enter the mobile number the owner invited. We'll send a 6-digit code to it.</T>
      {banner ? <Banner tone={banner.tone} title={banner.title} text={banner.text} style={{ marginBottom: 14 }} /> : null}
      <MobileField value={mobile} onChange={(v) => { setMobile(v); setErr(null); }} error={err} hint="Only numbers invited by the owner can be set up." autoFocus onSubmit={send} />
    </AuthLayout>
  );
}
