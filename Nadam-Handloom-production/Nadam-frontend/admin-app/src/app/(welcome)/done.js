// Setup finished.
import { useEffect, useState } from 'react';
import { router, useLocalSearchParams } from 'expo-router';
import { AuthLayout } from '../../components/AuthLayout';
import { T } from '../../components/T';
import { Button } from '../../components/Button';
import { Facts } from '../../components/Bits';
import { SuccessMark } from '../../components/SuccessMark';
import { useSession } from '../../auth/session';
import { getBiometricStatus } from '../../auth/biometrics';

export default function Done() {
  const s = useSession();
  const { bio } = useLocalSearchParams();
  const [label, setLabel] = useState('Face ID');
  useEffect(() => { getBiometricStatus().then((b) => setLabel(b.label)); }, []);
  const first = (s.user?.name || '').split(' ')[0];
  return (
    <AuthLayout footer={<Button title="Go to Home" onPress={() => router.replace('/home')} />}>
      <SuccessMark />
      <T variant="title" style={{ textAlign: 'center' }}>You're all set{first ? `, ${first}` : ''}</T>
      <T color="text2" style={{ textAlign: 'center', marginTop: 8, marginBottom: 18 }}>Your account is ready.</T>
      <Facts items={[
        `Signed in on this ${s.device?.name || 'phone'}`,
        'Stays signed in for 7 days, renewed every time you use the app',
        bio === '1' ? `${label} is on` : `${label} is off (turn it on any time in My account)`,
      ]} />
    </AuthLayout>
  );
}
