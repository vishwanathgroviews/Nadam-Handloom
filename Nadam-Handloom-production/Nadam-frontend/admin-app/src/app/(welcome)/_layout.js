// Screens right after a sign-in that started a journey (setup, reset): no menu yet.
import { Redirect, Stack } from 'expo-router';
import { useSession } from '../../auth/session';

export default function WelcomeLayout() {
  const s = useSession();
  if (s.status !== 'signedIn') return <Redirect href="/sign-in" />;
  return <Stack screenOptions={{ headerShown: false, animation: 'fade' }} />;
}
