// First route: Home if still signed in, a message if the sign-in ended, else Sign in
// (which offers Face ID straight away when it's on).
import { Redirect } from 'expo-router';
import { useSession } from '../auth/session';

export default function Index() {
  const s = useSession();
  if (s.status === 'signedIn') return <Redirect href="/home" />;
  if (s.notice) return <Redirect href={`/notice?kind=${s.notice}`} />;
  return <Redirect href="/sign-in?auto=1" />;
}
