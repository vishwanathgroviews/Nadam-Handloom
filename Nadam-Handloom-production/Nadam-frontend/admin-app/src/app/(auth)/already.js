// Shown only after the SMS code proved this person holds the phone.
import { router } from 'expo-router';
import { AuthLayout } from '../../components/AuthLayout';
import { T } from '../../components/T';
import { Button } from '../../components/Button';
import { MessageIcon } from '../../components/Bits';
import { useFlow } from '../../auth/flow';
import { formatMobile } from '../../utils/phone';

export default function Already() {
  const f = useFlow();
  return (
    <AuthLayout onBack={() => router.replace('/sign-in')} footer={<>
      <Button title="Sign in" onPress={() => router.replace('/sign-in')} />
      <Button title="Choose a new PIN" kind="secondary" onPress={() => router.replace('/set-pin?purpose=reset')} />
    </>}>
      <MessageIcon name="info" />
      <T variant="title" style={{ textAlign: 'center' }}>This number is already set up</T>
      <T color="text2" style={{ textAlign: 'center', marginTop: 8 }}>
        +91 {formatMobile(f.mobile || '')} already has a PIN. Sign in, or choose a new PIN if you've forgotten it. You've just verified the SMS code, so no new code is needed.
      </T>
    </AuthLayout>
  );
}
