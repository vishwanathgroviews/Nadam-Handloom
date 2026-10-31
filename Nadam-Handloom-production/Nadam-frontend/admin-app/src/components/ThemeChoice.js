// App theme picker for More → This phone: Auto (follows the phone), Light, Dark.
import { Pressable, View } from 'react-native';
import { useTheme } from '../theme/ThemeProvider';
import { THEME_CHOICES, themePref, useThemePref } from '../theme/themePref';
import { T } from './T';

export function ThemeChoice() {
  const { c, radius } = useTheme();
  const pref = useThemePref();
  return (
    <View style={{ paddingHorizontal: 16, paddingBottom: 14, gap: 6, borderBottomWidth: 1, borderBottomColor: c.border }}>
      <View accessibilityRole="radiogroup" accessibilityLabel="App theme" style={{ flexDirection: 'row', gap: 4, padding: 4, borderRadius: radius.md, backgroundColor: c.surface2, borderWidth: 1, borderColor: c.border }}>
        {THEME_CHOICES.map(([key, label]) => {
          const on = pref === key;
          return (
            <Pressable key={key} accessibilityRole="radio" accessibilityState={{ selected: on }} accessibilityLabel={key === 'auto' ? 'Auto, follows the phone' : label} onPress={() => themePref.set(key)}
              style={{ flex: 1, minHeight: 42, borderRadius: radius.md - 3, alignItems: 'center', justifyContent: 'center', backgroundColor: on ? c.surface : 'transparent', paddingHorizontal: 4 }}>
              <T variant="smallStrong" color={on ? 'text' : 'text2'} style={{ textAlign: 'center' }}>{label}</T>
            </Pressable>
          );
        })}
      </View>
      <T variant="caption" color="muted" style={{ marginLeft: 4 }}>Auto follows the phone's own light or dark setting.</T>
    </View>
  );
}
