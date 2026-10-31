// Sign in (docs 4.2): remembered number, 6-digit PIN (old 4-digit PINs once),
// Face ID / Touch ID / fingerprint, and every error the server can give.
import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, Keyboard, Pressable, View } from 'react-native';
import { Redirect, router, useLocalSearchParams } from 'expo-router';
import { AuthLayout } from '../../components/AuthLayout';
import { T } from '../../components/T';
import { Button, LinkButton } from '../../components/Button';
import { Banner } from '../../components/Banner';
import { MobileField } from '../../components/MobileField';
import { PinBoxes } from '../../components/PinBoxes';
import { Avatar } from '../../components/Bits';
import { useFeedback } from '../../components/Feedback';
import { useTheme } from '../../theme/ThemeProvider';
import { publicApi } from '../../api/client';
import { session, useSession, getRemembered } from '../../auth/session';
import { flowStore } from '../../auth/flow';
import { getDeviceInfo } from '../../auth/device';
import { getBiometricStatus, signInWithBiometric } from '../../auth/biometrics';
import { hasLocalBiometricKey } from '../../auth/biometricKeys';
import { getDrafts } from '../../auth/drafts';
import { useOnline } from '../../hooks/useOnline';
import { formatMobile, mobileError } from '../../utils/phone';

export default function SignIn() {
  const { auto } = useLocalSearchParams();
  const s = useSession();
  const { c } = useTheme();
  const online = useOnline();
  const { showToast } = useFeedback();
  const pinRef = useRef(null);
  const autoTried = useRef(false);

  const [remembered, setRemembered] = useState(null);
  const [manual, setManual] = useState(false);
  const [mobile, setMobile] = useState('');
  const [mobileErr, setMobileErr] = useState(null);
  const [pin, setPin] = useState('');
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState(null); // { kind: wrong|offline|server|lockout|limited, ... }
  const [bio, setBio] = useState({ available: false, label: 'Face ID', inSentence: 'Face ID', enabled: false });

  useEffect(() => {
    (async () => {
      const r = await getRemembered();
      setRemembered(r);
      if (r?.mobile) setMobile(r.mobile);
      const status = await getBiometricStatus();
      const enabled = r?.accountId ? await hasLocalBiometricKey(r.accountId) : false;
      setBio({ ...status, enabled });
    })();
  }, []);

  // Coming back from the phone's Settings: Face ID / fingerprint may have been set up or changed.
  useEffect(() => {
    const sub = AppState.addEventListener('change', async (st) => {
      if (st !== 'active') return;
      const r = await getRemembered();
      const status = await getBiometricStatus();
      const enabled = r?.accountId ? await hasLocalBiometricKey(r.accountId) : false;
      setBio({ ...status, enabled });
    });
    return () => sub.remove();
  }, []);

  const showRemembered = remembered && !manual;
  const canBio = showRemembered && bio.available && bio.enabled;

  const finishSignIn = useCallback(async (payload) => {
    Keyboard.dismiss();
    await session.applySignIn(payload);
    const drafts = await getDrafts(payload.user.id);
    router.replace('/home');
    showToast(drafts.length ? 'Welcome back. Your unsaved work is safe.' : 'Signed in', 'success');
  }, [showToast]);

  const networkProblem = (err) => {
    if (err.code === 'NETWORK') return setProblem({ kind: 'offline' });
    if (err.code === 'TIMEOUT') return setProblem({ kind: 'server' });
    if (err.code === 'RATE_LIMITED') return setProblem({ kind: 'limited' });
    return setProblem({ kind: 'server', message: err.message });
  };

  const useBiometric = useCallback(async () => {
    if (!remembered) return;
    setProblem(null);
    try {
      const payload = await signInWithBiometric({ mobile: remembered.mobile, accountId: remembered.accountId, label: bio.label });
      await finishSignIn(payload);
    } catch (err) {
      switch (err.code) {
        case 'CANCELLED':
        case 'FALLBACK':
          pinRef.current?.focus();
          break;
        case 'LOCKOUT':
          setProblem({ kind: 'lockout' });
          break;
        case 'INVALIDATED':
          setBio((b) => ({ ...b, enabled: false }));
          setRemembered((r) => ({ ...r, faceChanged: true }));
          break;
        case 'KEY_NOT_FOUND':
        case 'BIOMETRIC_UNAVAILABLE':
        case 'BIOMETRIC_INVALID':
          setBio((b) => ({ ...b, enabled: false }));
          showToast(`${bio.label} sign-in is off on this phone. Sign in with your PIN.`);
          break;
        case 'LOCKED':
          flowStore.reset({ lock: err.details, mobile: remembered.mobile });
          router.push('/locked');
          break;
        case 'NOT_ENROLLED':
        case 'NOT_AVAILABLE':
          setBio((b) => ({ ...b, available: false }));
          showToast(err.message);
          break;
        default:
          networkProblem(err);
      }
    }
  }, [remembered, bio.label, finishSignIn, showToast]);

  // Offer Face ID / fingerprint straight away when the app opens.
  useEffect(() => {
    if (auto === '1' && canBio && !autoTried.current) {
      autoTried.current = true;
      const t = setTimeout(useBiometric, 400);
      return () => clearTimeout(t);
    }
    return undefined;
  }, [auto, canBio, useBiometric]);

  async function submit(enteredPin = pin) {
    const err = mobileError(mobile);
    if (err) return setMobileErr(err);
    if (enteredPin.length !== 4 && enteredPin.length !== 6) return undefined;
    setMobileErr(null);
    setProblem(null);
    setBusy(true);
    try {
      const device = await getDeviceInfo();
      const res = await publicApi('/auth/login', { method: 'POST', body: { mobile, pin: enteredPin, device } });
      setPin('');
      if (res.status === 'signed_in') return finishSignIn(res);
      if (res.status === 'verify_device') {
        flowStore.reset({ purpose: 'device', stepToken: res.stepToken, mobile, mobileMasked: res.mobileMasked });
        return router.push('/new-device');
      }
      if (res.status === 'upgrade_pin') {
        flowStore.reset({ purpose: 'upgrade', stepToken: res.stepToken, mobile });
        return router.push('/set-pin?purpose=upgrade');
      }
    } catch (e) {
      setPin('');
      if (e.code === 'INVALID_CREDENTIALS') {
        setProblem({ kind: 'wrong', triesLeft: e.details.triesLeft, nextLockMinutes: e.details.nextLockMinutes });
        pinRef.current?.shake();
      } else if (e.code === 'LOCKED') {
        flowStore.reset({ lock: e.details, mobile });
        router.push('/locked');
      } else if (e.code === 'VALIDATION_FAILED') {
        setMobileErr(e.message);
      } else {
        networkProblem(e);
      }
    } finally {
      setBusy(false);
    }
    return undefined;
  }

  if (s.status === 'signedIn') return <Redirect href="/home" />;

  const banners = [];
  if (!online) banners.push(<Banner key="off" tone="warning" icon="wifioff" title="You're offline" text="Signing in needs internet. Your work on this phone is safe." />);
  if (showRemembered && remembered?.faceChanged) banners.push(<Banner key="fc" tone="warning" title={`${bio.label} was turned off`} text={`This phone's ${bio.type === 'fingerprint' ? 'fingerprints' : 'face settings'} changed. Sign in with your PIN, then turn it on again in My account.`} />);
  if (problem?.kind === 'wrong') {
    banners.push(problem.triesLeft === 1
      ? <Banner key="w" tone="warning" title="1 try left" text={`That mobile number and PIN don't match. After one more wrong try, sign-in is locked for ${problem.nextLockMinutes} minutes.`} />
      : <Banner key="w" tone="error" title="That mobile number and PIN don't match" text={`${problem.triesLeft} tries left.`} />);
  }
  if (problem?.kind === 'offline' && online) banners.push(<Banner key="o" tone="warning" icon="wifioff" title="Can't reach the server" text="Check your internet and try again. Nothing was lost." />);
  if (problem?.kind === 'server') banners.push(<Banner key="s" tone="error" icon="clock" title="The server is taking too long" text="Nothing was lost, and this try wasn't counted against your PIN. Try again in a moment." />);
  if (problem?.kind === 'limited') banners.push(<Banner key="l" tone="warning" title="Too many attempts from this network" text="Please wait a minute and try again." />);
  if (problem?.kind === 'lockout') banners.push(<Banner key="lo" tone="warning" title={`${bio.label} is locked`} text="Too many tries. Unlock the phone with its passcode, or use your PIN." />);

  return (
    <AuthLayout hero>
      <T variant="heading">{showRemembered ? 'Welcome back' : 'Sign in'}</T>
      <T color="text2" style={{ marginTop: 2, marginBottom: 14 }}>
        {showRemembered ? `Enter your PIN${canBio ? ` or use ${bio.inSentence}` : ''}.` : 'Use your mobile number and PIN.'}
      </T>
      {banners.length ? <View style={{ gap: 10, marginBottom: 14 }}>{banners}</View> : null}

      {showRemembered ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderRadius: 14, backgroundColor: c.surface2, marginBottom: 16 }}>
          <Avatar name={remembered.name} size={42} />
          <View style={{ flex: 1 }}>
            <T variant="bodyStrong">{remembered.name}</T>
            <T variant="small" color="muted">+91 {formatMobile(remembered.mobile)}</T>
          </View>
          <LinkButton title="Not you?" onPress={() => { setManual(true); setMobile(''); setPin(''); setProblem(null); }} />
        </View>
      ) : (
        <MobileField value={mobile} onChange={(v) => { setMobile(v); setMobileErr(null); }} error={mobileErr} autoFocus={!remembered} onSubmit={() => pinRef.current?.focus()} />
      )}

      <PinBoxes
        ref={pinRef}
        value={pin}
        onChange={(v) => { setPin(v); if (problem?.kind === 'wrong') setProblem(null); }}
        onComplete={(v) => submit(v)}
        onSubmit={(v) => submit(v)} // keyboard Done: signs in with an old 4-digit PIN too
        error={problem?.kind === 'wrong'}
        autoFocus={!!showRemembered && !canBio}
        rightTool={<LinkButton title="Forgot PIN?" onPress={() => { flowStore.reset({ mobile }); router.push('/forgot'); }} />}
      />

      <View style={{ gap: 10, marginTop: 14 }}>
        <Button title="Sign in" loading={busy} disabled={pin.length !== 4 && pin.length !== 6} onPress={() => submit()} />
        {canBio ? <Button title={`Use ${bio.label}`} kind="secondary" icon={bio.type === 'fingerprint' ? 'finger' : 'faceid'} onPress={useBiometric} /> : null}
      </View>

      <View style={{ alignItems: 'center', gap: 12, marginTop: 18 }}>
        <T variant="small" color="muted" style={{ textAlign: 'center' }}>Still on an old 4-digit PIN? Enter it and tap Sign in.</T>
        <Pressable accessibilityRole="button" onPress={() => { flowStore.reset({}); router.push('/setup'); }} hitSlop={8}>
          <T variant="smallStrong" color="primary" style={{ textDecorationLine: 'underline' }}>First time here? Set up your account</T>
        </Pressable>
      </View>
    </AuthLayout>
  );
}
