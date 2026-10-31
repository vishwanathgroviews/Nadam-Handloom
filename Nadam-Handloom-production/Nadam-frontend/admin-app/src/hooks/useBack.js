// Back for any page that sits on top of the tabs. Pages open on top of the one they
// were opened from (see app/(app)/_layout.js), so Back is simply "the page before",
// the same place the iPhone's swipe from the edge and Android's back go.
// "?back=home" or "?back=/path" (Modules 8–10) only matters when there is no page
// before: the app was restarted on this page or it was opened from a link. Then
// Back goes there, else to `fallback`, else Home.
import { useCallback } from 'react';
import { router, useLocalSearchParams } from 'expo-router';

export function backTarget(back, fallback = null) {
  if (back === 'home') return '/home';
  if (typeof back === 'string' && back.startsWith('/')) return back;
  return fallback || '/home';
}

export function useBack(fallback = null) {
  const { back } = useLocalSearchParams();
  return useCallback(() => {
    if (router.canGoBack()) router.back();
    else router.replace(backTarget(back, fallback));
  }, [back, fallback]);
}
