import { useEffect, useState } from 'react';

// Milliseconds left until `untilMs` (a timestamp), ticking every second; follows the
// real clock, so it stays right after the app was in the background.
export function useCountdown(untilMs) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!untilMs) return undefined;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [untilMs]);
  return untilMs ? Math.max(0, untilMs - now) : 0;
}
