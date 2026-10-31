// The signed-in app. If the sign-in ends (server said so, or 7 days unused) the
// person is taken to the matching message screen. It also checks in with the
// server (app back in front, tab opened) so a role change shows without signing out.
//
// Screens: the five tabs sit at the bottom of one stack, and every other page opens
// ON TOP of whatever is showing. So Back, the iPhone's swipe from the edge and
// Android's back all return to the page it was opened from, whichever tab that was.
// (Until 15 Oct 2026 each tab had its own stack and links from Home opened inside
// another tab: the swipe had nothing to go back to.)
import { useEffect } from 'react';
import { Redirect, Stack } from 'expo-router';
import { session, useSession } from '../../auth/session';
import { useCheckIn } from '../../auth/checkIn';
import { useFeedback } from '../../components/Feedback';
import { queue } from '../../products/queue';
import { batchStore } from '../../products/batch';
import { billStore } from '../../sales/bill';
import { orderCount } from '../../orders/count';
import { homePrefs } from '../../home/prefs';
import { usePaymentNotifications } from '../../push/usePaymentNotifications';

// A page opened straight from a link (or the app restarted on it) still has the
// tabs underneath, so Back always has somewhere to go.
export const unstable_settings = { initialRouteName: '(tabs)' };

export default function AppLayout() {
  const s = useSession();
  const { showToast } = useFeedback();
  useCheckIn();
  // Module 4: sarees waiting to upload carry on in the background; a half-tagged batch is restored.
  // Module 5: the bill this person was building comes back.
  const signedIn = s.status === 'signedIn';
  const userId = s.user?.id;
  useEffect(() => {
    if (!signedIn) return;
    queue.start();
    batchStore.load();
  }, [signedIn]);
  useEffect(() => {
    if (signedIn && userId) { billStore.load(); orderCount.refresh(); homePrefs.load(); }
  }, [signedIn, userId]);
  // Owners: payment notifications (token kept fresh; a tap opens that payment).
  usePaymentNotifications(s.user, signedIn);
  useEffect(() => {
    if (!s.roleChange) return;
    showToast(s.roleChange.to === 'owner' ? 'Your role is now Owner. Owner screens are now on.' : 'Your role is now Staff. Some owner-only screens are hidden.', 'success');
    session.clearRoleChange();
  }, [s.roleChange, showToast]);
  if (s.status !== 'signedIn') return <Redirect href={s.notice ? `/notice?kind=${s.notice}` : '/sign-in'} />;
  return (
    <Stack screenOptions={{ headerShown: false, animation: 'slide_from_right' }}>
      <Stack.Screen name="(tabs)" />
      {/* The sale is done: going back would land on the old bill. Next customer, the
          arrow and Android's back all go to a fresh Sell screen instead. */}
      <Stack.Screen name="scan/sold" options={{ gestureEnabled: false }} />
    </Stack>
  );
}
