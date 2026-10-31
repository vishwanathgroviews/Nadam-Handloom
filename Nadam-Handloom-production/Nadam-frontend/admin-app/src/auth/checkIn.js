// Asks the server for the latest profile, so a role change made by an owner shows
// on this phone without signing out: when the app comes back to the front, when
// a tab opens, and when the server refuses something (at most every 15 seconds).
import { useEffect } from 'react';
import { AppState } from 'react-native';
import { api } from '../api/client';
import { session } from './session';

const MIN_GAP_MS = 15_000;
let last = 0;

export async function checkIn({ force = false } = {}) {
  if (session.getState().status !== 'signedIn') return;
  if (!force && Date.now() - last < MIN_GAP_MS) return;
  last = Date.now();
  try {
    const me = await api('/me');
    await session.updateUser(me.user);
  } catch {
    // Offline or the server is slow: try again next time. A sign-in that ended is handled by api().
  }
}

export function useCheckIn() {
  useEffect(() => {
    checkIn();
    const sub = AppState.addEventListener('change', (st) => { if (st === 'active') checkIn(); });
    return () => sub.remove();
  }, []);
}
