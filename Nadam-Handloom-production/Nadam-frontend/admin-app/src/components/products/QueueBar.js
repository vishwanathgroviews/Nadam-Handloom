// "Saving 3 of 8 sarees…" — follows the person around the Products screens while the
// upload queue works in the background. Tap to see the details.
import { ActivityIndicator, Pressable, View } from 'react-native';
import { router } from 'expo-router';
import { useTheme } from '../../theme/ThemeProvider';
import { useOnline } from '../../hooks/useOnline';
import { Icon } from '../Icon';
import { T } from '../T';
import { useUploads } from '../../products/queue';
import { plural } from '../../utils/products';

export function QueueBar({ style }) {
  const { c, radius } = useTheme();
  const online = useOnline();
  const u = useUploads();
  if (!u.open.length) return null;
  const tone = u.failed ? [c.dangerSoft, c.danger] : !online ? [c.warningSoft, c.warning] : [c.primarySoft, c.primary];
  const text = u.failed
    ? `${plural(u.failed, 'saree needs', 'sarees need')} a different tag`
    : !online ? `No internet · ${plural(u.waiting, 'saree')} kept on this phone, uploads by itself`
      : `Saving ${plural(u.waiting, 'saree')}…`;
  return (
    <Pressable accessibilityRole="button" onPress={() => router.push('/products/add/saving')} style={[{ flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, borderRadius: radius.md, backgroundColor: tone[0], marginBottom: 12 }, style]}>
      {u.failed ? <Icon name="alertc" size={18} color={tone[1]} /> : online ? <ActivityIndicator size="small" color={tone[1]} /> : <Icon name="wifioff" size={18} color={tone[1]} />}
      <T variant="smallStrong" color={tone[1]} style={{ flex: 1 }}>{text}</T>
      <View><Icon name="right" size={16} color={tone[1]} /></View>
    </Pressable>
  );
}
