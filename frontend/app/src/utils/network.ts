import { useEffect, useState } from 'react';
import NetInfo from '@react-native-community/netinfo';

/**
 * True when the device has a network connection AND that connection is
 * confirmed reachable (not just "Wi-Fi is on"). Defaults to `true` until the
 * first NetInfo event arrives, so screens don't flash an "offline" banner
 * on cold start before NetInfo has reported anything.
 */
export const useIsOnline = (): boolean => {
  const [isOnline, setIsOnline] = useState(true);

  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener((state) => {
      setIsOnline(state.isConnected !== false && state.isInternetReachable !== false);
    });
    return unsubscribe;
  }, []);

  return isOnline;
};
