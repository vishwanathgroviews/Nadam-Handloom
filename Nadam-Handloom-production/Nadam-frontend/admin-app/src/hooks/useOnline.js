import { useEffect, useState } from 'react';
import NetInfo from '@react-native-community/netinfo';

// true / false once known; assumes online until the first reading arrives.
export function useOnline() {
  const [online, setOnline] = useState(true);
  useEffect(() => NetInfo.addEventListener((s) => setOnline(s.isConnected !== false && s.isInternetReachable !== false)), []);
  return online;
}
