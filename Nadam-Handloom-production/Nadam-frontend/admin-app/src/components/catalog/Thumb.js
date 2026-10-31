// A small photo (or a placeholder when there's none).
import { Image, View } from 'react-native';
import { useTheme } from '../../theme/ThemeProvider';
import { Icon } from '../Icon';

export function Thumb({ uri, width = 52, height = 40 }) {
  const { c } = useTheme();
  return (
    <View style={{ width, height, borderRadius: 8, overflow: 'hidden', backgroundColor: c.surface3, alignItems: 'center', justifyContent: 'center' }}>
      {uri ? <Image source={{ uri }} style={{ width, height }} resizeMode="cover" accessibilityIgnoresInvertColors /> : <Icon name="image" size={20} color={c.muted} />}
    </View>
  );
}

// A large photo at the top of a category or subcategory page: 16:9, or a category's tall
// card shape (3:4, as on the website's home page).
export function HeroPhoto({ uri, children, ratio = 16 / 9, style }) {
  const { c, radius } = useTheme();
  return (
    <View style={[{ aspectRatio: ratio, borderRadius: radius.lg, overflow: 'hidden', backgroundColor: c.surface3, alignItems: 'center', justifyContent: 'center', marginBottom: 14 }, style]}>
      {uri ? <Image source={{ uri }} style={{ width: '100%', height: '100%' }} resizeMode="cover" accessibilityIgnoresInvertColors /> : <Icon name="image" size={44} color={c.muted} strokeWidth={1.4} />}
      {children}
    </View>
  );
}
