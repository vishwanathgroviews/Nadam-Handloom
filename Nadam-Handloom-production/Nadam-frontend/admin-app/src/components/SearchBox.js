// A search box with a clear button.
import { Pressable, TextInput, View } from 'react-native';
import { useTheme } from '../theme/ThemeProvider';
import { Icon } from './Icon';

export function SearchBox({ value, onChange, placeholder, label }) {
  const { c, radius, type } = useTheme();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', borderWidth: 1.5, borderColor: c.borderStrong, borderRadius: radius.md, backgroundColor: c.surface, paddingHorizontal: 12, marginBottom: 10 }}>
      <Icon name="search" size={18} color={c.muted} />
      <TextInput value={value} onChangeText={onChange} placeholder={placeholder} placeholderTextColor={c.muted} autoCorrect={false} returnKeyType="search"
        accessibilityLabel={label || placeholder} style={[type.body, { flex: 1, minHeight: 48, paddingHorizontal: 10, color: c.text }]} />
      {value ? <Pressable accessibilityRole="button" accessibilityLabel="Clear search" onPress={() => onChange('')} hitSlop={10}><Icon name="x" size={18} color={c.muted} /></Pressable> : null}
    </View>
  );
}
