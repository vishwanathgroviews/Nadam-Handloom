// Sign-in locked after 5 wrong PINs: 15, then 30, then 60 minutes. After the
// timer there are 5 fresh tries. Forgot PIN unlocks at any time.
import { View } from 'react-native';
import { Redirect, router } from 'expo-router';
import { AuthLayout } from '../../components/AuthLayout';
import { T } from '../../components/T';
import { Button } from '../../components/Button';
import { Banner } from '../../components/Banner';
import { MessageIcon, Progress } from '../../components/Bits';
import { useTheme } from '../../theme/ThemeProvider';
import { useFlow, flowStore } from '../../auth/flow';
import { useCountdown } from '../../hooks/useCountdown';
import { formatMobile } from '../../utils/phone';
import { mmss } from '../../utils/time';

export default function Locked() {
  const f = useFlow();
  const { type } = useTheme();
  const until = f.lock?.lockedUntil ? new Date(f.lock.lockedUntil).getTime() : 0;
  const left = useCountdown(until);
  if (!f.lock) return <Redirect href="/sign-in" />;
  const total = (f.lock.lockMinutes || 15) * 60000;
  const over = left === 0;
  return (
    <AuthLayout onBack={() => router.replace('/sign-in')} footer={<>
      <Button title="Reset PIN with an SMS code" onPress={() => { flowStore.reset({ mobile: f.mobile }); router.replace('/forgot'); }} />
      <Button title="Back to sign in" kind="secondary" onPress={() => router.replace('/sign-in')} />
    </>}>
      <MessageIcon name="lock" tone="danger" />
      <T variant="title" style={{ textAlign: 'center' }}>Sign-in locked</T>
      <T color="text2" style={{ textAlign: 'center', marginTop: 8 }}>Too many wrong PINs{f.mobile ? ` for +91 ${formatMobile(f.mobile)}` : ''}.</T>
      {over ? (
        <Banner tone="success" title="You can try again now" text="You have 5 fresh tries." style={{ marginTop: 20 }} />
      ) : (
        <View style={{ alignItems: 'center', marginTop: 16 }}>
          <T style={[type.display, { fontVariant: ['tabular-nums'] }]} accessibilityLiveRegion="polite">{mmss(left)}</T>
          <Progress fraction={left / total} tone="danger" style={{ width: 220, marginTop: 10 }} />
        </View>
      )}
      <View style={{ marginTop: 22, gap: 8 }}>
        <T variant="small" color="text2">• This is lock {f.lock.lockCount}. It lasts {f.lock.lockMinutes} minutes.</T>
        <T variant="small" color="text2">• If it happens again, the next lock lasts {f.lock.nextLockMinutes} minutes.</T>
        <T variant="small" color="text2">• When the timer ends, you get 5 fresh tries.</T>
      </View>
    </AuthLayout>
  );
}
