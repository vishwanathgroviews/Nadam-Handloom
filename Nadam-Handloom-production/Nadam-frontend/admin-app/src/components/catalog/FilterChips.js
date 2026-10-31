// Filter chips with counts. Catalogue: All · Hidden · Needs photo · No products (the
// default); other lists pass their own `items` ([key, label] pairs).
import { Pressable, ScrollView } from 'react-native';
import { useTheme } from '../../theme/ThemeProvider';
import { T } from '../T';
import { FILTERS } from '../../utils/catalog';

export function FilterChips({ value, counts, onChange, items = FILTERS }) {
  const { c, radius } = useTheme();
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingBottom: 12 }} accessibilityRole="tablist">
      {items.map(([key, label]) => {
        const on = value === key;
        return (
          <Pressable key={key} accessibilityRole="tab" accessibilityState={{ selected: on }} onPress={() => onChange(key)}
            style={{ flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 36, paddingHorizontal: 13, borderRadius: radius.pill, borderWidth: 1, borderColor: on ? c.primary : c.borderStrong, backgroundColor: on ? c.primary : c.surface }}>
            <T variant="smallStrong" color={on ? c.onPrimary : c.text2}>{label}</T>
            {counts && counts[key] != null ? <T variant="caption" color={on ? c.onPrimary : 'muted'}>{counts[key]}</T> : null}
          </Pressable>
        );
      })}
    </ScrollView>
  );
}
