// The bar at the top of signed-in screens when the phone is offline or the server
// can't be reached. Nobody is signed out for either. Under it, "a new version is
// available" (Module 11).
import { View } from 'react-native';
import { useTheme } from '../theme/ThemeProvider';
import { useOnline } from '../hooks/useOnline';
import { useServerUnreachable } from '../api/connectivity';
import { Icon } from './Icon';
import { T } from './T';
import { NewVersionBar } from '../gate/Gate';

// what="sell": selling never happens offline (Module 5, decision 6.4), so the bar says
// the bill waits instead of "changes will send".
export function StatusBanner({ what } = {}) {
  const { c } = useTheme();
  const online = useOnline();
  const serverDown = useServerUnreachable();
  if (online && !serverDown) return <NewVersionBar />;
  const text = what === 'sell'
    ? `${online ? 'Can\'t reach the server' : 'Offline'}. Selling waits until it's back; the bill stays on this phone.`
    : !online
      ? 'Offline. You\'re still signed in; changes will send when you\'re back online.'
      : 'Can\'t reach the server right now. You\'re still signed in; changes will send when it\'s back.';
  return (
    <>
      <View accessibilityRole="summary" style={{ flexDirection: 'row', gap: 8, alignItems: 'center', justifyContent: 'center', paddingVertical: 8, paddingHorizontal: 16, backgroundColor: c.warningSoft }}>
        <Icon name={online ? 'clock' : 'wifioff'} size={16} color={c.warning} />
        <T variant="caption" color="warning" style={{ flexShrink: 1, fontFamily: 'PlusJakartaSans_600SemiBold' }}>{text}</T>
      </View>
      <NewVersionBar />
    </>
  );
}
