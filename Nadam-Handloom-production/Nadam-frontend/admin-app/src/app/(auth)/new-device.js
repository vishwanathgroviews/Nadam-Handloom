// New phone check (docs 4.3): the PIN was right, but this phone isn't trusted yet.
import { useState } from 'react';
import { Redirect, router } from 'expo-router';
import { AuthLayout } from '../../components/AuthLayout';
import { T } from '../../components/T';
import { Button } from '../../components/Button';
import { Banner } from '../../components/Banner';
import { MessageIcon, Facts } from '../../components/Bits';
import { useFlow } from '../../auth/flow';
import { requestCode } from '../../auth/codeRequests';
import { mmss } from '../../utils/time';

export default function NewDevice() {
  const f = useFlow();
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState(null);
  if (!f.stepToken) return <Redirect href="/sign-in" />;

  async function send() {
    setBusy(true);
    setProblem(null);
    try {
      await requestCode('device');
      router.push('/code');
    } catch (e) {
      if (e.code === 'CODE_RESEND_WAIT') setProblem({ tone: 'warning', title: 'A code was sent a moment ago', text: `Wait ${mmss(e.details.retryAfterSeconds * 1000)} for a new one.` });
      else if (e.code === 'STEP_EXPIRED') setProblem({ tone: 'error', title: 'This step timed out', text: 'Sign in again to continue.' });
      else setProblem({ tone: 'warning', title: e.code === 'NETWORK' ? 'Can\'t reach the server' : 'Couldn\'t send the code', text: e.message });
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthLayout onBack={() => router.replace('/sign-in')} footer={<>
      <Button title="Send code" loading={busy} onPress={send} />
      <Button title="Cancel" kind="ghost" onPress={() => router.replace('/sign-in')} />
    </>}>
      <MessageIcon name="shield" />
      <T variant="title" style={{ textAlign: 'center' }}>New phone: quick check</T>
      <T color="text2" style={{ textAlign: 'center', marginTop: 8, marginBottom: 18 }}>
        Your PIN is right. This is the first time you're signing in on this phone, so we'll send a code to {f.mobileMasked}.
      </T>
      {problem ? <Banner tone={problem.tone} title={problem.title} text={problem.text} style={{ marginBottom: 14 }} /> : null}
      <Facts items={['Needed only once on each phone or tablet', 'Keeps your account safe even if someone learns your PIN', 'This phone then appears in My devices']} />
    </AuthLayout>
  );
}
