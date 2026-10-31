// Forgot PIN finished: signed in here, every other device signed out.
import { router } from 'expo-router';
import { AuthLayout } from '../../components/AuthLayout';
import { T } from '../../components/T';
import { Button } from '../../components/Button';
import { Facts } from '../../components/Bits';
import { SuccessMark } from '../../components/SuccessMark';
import { useFlow } from '../../auth/flow';

export default function ResetDone() {
  const { othersSignedOut = 0 } = useFlow();
  return (
    <AuthLayout footer={<Button title="Go to Home" onPress={() => router.replace('/home')} />}>
      <SuccessMark />
      <T variant="title" style={{ textAlign: 'center' }}>PIN changed</T>
      <T color="text2" style={{ textAlign: 'center', marginTop: 8, marginBottom: 18 }}>You're signed in on this phone with your new PIN.</T>
      <Facts items={[
        othersSignedOut ? `${othersSignedOut} other device${othersSignedOut > 1 ? 's were' : ' was'} signed out for safety` : 'No other devices were signed in',
        'Any sign-in lock was cleared',
        'Face ID / fingerprint was turned off; turn it on again in My account',
        'On other devices, sign in with the new PIN and an SMS code',
      ]} />
    </AuthLayout>
  );
}
