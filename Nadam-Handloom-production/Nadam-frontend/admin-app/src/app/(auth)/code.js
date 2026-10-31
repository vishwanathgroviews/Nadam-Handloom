// The SMS code (setup, Forgot PIN, new phone). Codes live 60 seconds (Message
// Central), allow 3 wrong tries, and can be re-sent after 60 seconds.
import { useRef, useState } from 'react';
import { Keyboard, Pressable, View } from 'react-native';
import { Redirect, router } from 'expo-router';
import { AuthLayout } from '../../components/AuthLayout';
import { T } from '../../components/T';
import { Button, LinkButton } from '../../components/Button';
import { Banner } from '../../components/Banner';
import { CodeBoxes } from '../../components/CodeBoxes';
import { StepBar, Progress } from '../../components/Bits';
import { useFeedback } from '../../components/Feedback';
import { useTheme } from '../../theme/ThemeProvider';
import { publicApi } from '../../api/client';
import { flowStore, useFlow } from '../../auth/flow';
import { requestCode } from '../../auth/codeRequests';
import { getDeviceInfo } from '../../auth/device';
import { session } from '../../auth/session';
import { useCountdown } from '../../hooks/useCountdown';
import { formatMobile } from '../../utils/phone';
import { mmss } from '../../utils/time';

const TITLES = { setup: 'Enter the code', forgot: 'Enter the reset code', device: 'Verify this phone' };
const VERIFY = { setup: '/auth/setup/verify-code', forgot: '/auth/forgot/verify-code', device: '/auth/device/verify-code' };

export default function Code() {
  const f = useFlow();
  const { c } = useTheme();
  const { showToast } = useFeedback();
  const boxes = useRef(null);
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState(null);
  const expiresIn = useCountdown(f.expiresAt);
  const resendIn = useCountdown(f.resendAt);
  const purpose = f.purpose;
  if (!purpose || !VERIFY[purpose]) return <Redirect href="/sign-in" />;

  async function verify(entered = code) {
    if (entered.length !== 6) return setProblem({ tone: 'warning', title: 'Enter all 6 digits' });
    setBusy(true);
    setProblem(null);
    try {
      const device = await getDeviceInfo();
      const body = purpose === 'device' ? { stepToken: f.stepToken, code: entered, device } : { mobile: f.mobile, code: entered, deviceId: device.id };
      const res = await publicApi(VERIFY[purpose], { method: 'POST', body });
      Keyboard.dismiss();
      if (purpose === 'device') {
        if (res.status === 'upgrade_pin') {
          flowStore.set({ purpose: 'upgrade', stepToken: res.stepToken });
          return router.replace('/set-pin?purpose=upgrade');
        }
        await session.applySignIn(res);
        router.replace('/home');
        return showToast('This phone is now trusted', 'success');
      }
      flowStore.set({ stepToken: res.stepToken, mobileMasked: res.mobileMasked || f.mobileMasked });
      if (res.next === 'already_set_up') return router.replace('/already');
      return router.replace(`/set-pin?purpose=${purpose === 'setup' ? 'setup' : 'reset'}`);
    } catch (e) {
      setCode('');
      if (e.code === 'WRONG_CODE') setProblem({ tone: 'error', title: 'That code isn\'t right', text: `${e.details.triesLeft} ${e.details.triesLeft === 1 ? 'try' : 'tries'} left.` });
      else if (e.code === 'CODE_EXPIRED') setProblem({ tone: 'error', title: 'This code has expired', text: 'Tap Resend code to get a new one.' });
      else if (e.code === 'CODE_USED_UP') setProblem({ tone: 'error', title: 'Too many wrong tries', text: 'Tap Resend code to get a new one.' });
      else if (e.code === 'STEP_EXPIRED') setProblem({ tone: 'error', title: 'This step timed out', text: 'Please start again.', restart: true });
      else setProblem({ tone: 'warning', title: e.code === 'NETWORK' ? 'Can\'t reach the server' : 'Couldn\'t check the code', text: e.message });
    } finally {
      setBusy(false);
    }
    return undefined;
  }

  async function resend() {
    setProblem(null);
    setCode('');
    try {
      await requestCode(purpose);
      showToast('New code sent. The earlier code no longer works.', 'success');
      boxes.current?.focus();
    } catch (e) {
      if (e.code === 'CODE_TOO_MANY') setProblem({ tone: 'error', title: 'Too many codes requested', text: 'For safety, try again after 1 hour.' });
      else if (e.code === 'CODE_RESEND_WAIT') flowStore.set({ resendAt: Date.now() + e.details.retryAfterSeconds * 1000 });
      else setProblem({ tone: 'warning', title: 'Couldn\'t send a new code', text: e.message });
    }
  }

  const target = purpose === 'device' ? f.mobileMasked : `+91 ${formatMobile(f.mobile || '')}`;
  const generic = purpose === 'setup' ? ' If this number has been invited, the code is on its way.' : purpose === 'forgot' ? ' If this number has an account, the code is on its way.' : '';
  const expired = f.expiresAt && expiresIn === 0;

  return (
    <AuthLayout onBack={() => router.back()} footer={<Button title="Verify" loading={busy} onPress={() => verify()} />}>
      {purpose === 'setup' ? <StepBar step={2} total={4} /> : purpose === 'forgot' ? <StepBar step={2} total={3} /> : null}
      <T variant="title">{TITLES[purpose]}</T>
      <T color="text2" style={{ marginTop: 6, marginBottom: 16 }}>We sent a 6-digit code to <T variant="bodyStrong">{target}</T>.{generic}</T>
      {purpose !== 'device' ? <LinkButton title="Change number" onPress={() => router.back()} style={{ marginTop: -8, marginBottom: 14 }} /> : null}

      {f.devCode ? (
        <Pressable accessibilityRole="button" onPress={() => { setCode(f.devCode); verify(f.devCode); }} style={{ marginBottom: 14, padding: 12, borderRadius: 10, borderWidth: 1.5, borderStyle: 'dashed', borderColor: c.warning, backgroundColor: c.warningSoft }}>
          <T variant="caption" color="warning">TEST MODE · no SMS was sent</T>
          <T variant="bodyStrong">Code {f.devCode} · tap to fill</T>
        </Pressable>
      ) : null}

      {problem ? <Banner tone={problem.tone} title={problem.title} text={problem.text} style={{ marginBottom: 14 }} /> : null}
      <CodeBoxes ref={boxes} value={code} onChange={(v) => { setCode(v); setProblem(null); }} onComplete={(v) => verify(v)} error={problem?.tone === 'error'} />

      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 12 }}>
        <T variant="small" color={expiresIn && expiresIn < 20000 ? 'warning' : 'muted'} accessibilityLiveRegion="polite">{expired ? 'Code expired' : `Code expires in ${mmss(expiresIn)}`}</T>
        <Progress fraction={expiresIn / 60000} tone={expiresIn < 20000 ? 'warning' : 'primary'} style={{ flex: 1, maxWidth: 120 }} />
      </View>

      <View style={{ marginTop: 20, flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
        <T variant="small" color="text2">Didn't get it?</T>
        {resendIn > 0 ? <T variant="smallStrong" color="text2">Resend in {mmss(resendIn)}</T> : <LinkButton title="Resend code" onPress={resend} />}
      </View>
      {resendIn === 0 && purpose === 'setup' ? <T variant="caption" color="muted" style={{ marginTop: 8 }}>Still nothing? Check the number, or ask the owner to confirm it has been invited.</T> : null}
      {problem?.restart ? <Button title="Start again" kind="secondary" style={{ marginTop: 16 }} onPress={() => router.replace(purpose === 'device' ? '/sign-in' : purpose === 'forgot' ? '/forgot' : '/setup')} /> : null}
    </AuthLayout>
  );
}
