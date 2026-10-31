// A simple bar chart from plain views (Module 9, pick A: bars). Tap a bar to choose it;
// labels thin out when there are many bars. No chart library needed.
import { Pressable, View } from 'react-native';
import { useTheme } from '../../theme/ThemeProvider';
import { T } from '../T';
import { labelEvery, maxOf, share } from '../../utils/analytics';
import { rupees } from '../../utils/catalog';

export function BarChart({ bars, height = 140, selected = null, onSelect, muted = false }) {
  const { c } = useTheme();
  const max = maxOf(bars);
  const every = labelEvery(bars.length);
  const gap = bars.length > 20 ? 1 : 3;
  return (
    <View>
      <View style={{ flexDirection: 'row', alignItems: 'flex-end', height, gap, borderBottomWidth: 1, borderBottomColor: c.border }}>
        {bars.map((b, i) => {
          const on = selected === i;
          const bar = <View style={{ width: '100%', height: `${share(b.amount, max)}%`, borderTopLeftRadius: 4, borderTopRightRadius: 4, backgroundColor: on ? c.accent : muted ? c.primarySoft : c.primary }} />;
          return onSelect ? (
            <Pressable key={b.key} accessibilityRole="button" accessibilityLabel={`${b.title}, ${rupees(b.amount)}${b.bills != null ? `, ${b.bills} bills` : ''}`} onPress={() => onSelect(i)}
              style={{ flex: 1, height: '100%', justifyContent: 'flex-end' }} hitSlop={{ top: 6, bottom: 6 }}>{bar}</Pressable>
          ) : <View key={b.key} style={{ flex: 1, height: '100%', justifyContent: 'flex-end' }}>{bar}</View>;
        })}
      </View>
      <View style={{ flexDirection: 'row', gap, marginTop: 4 }}>
        {bars.map((b, i) => (
          <View key={b.key} style={{ flex: 1, alignItems: 'center', overflow: 'visible' }}>
            {i % every === 0 || i === bars.length - 1 ? <T variant="caption" color="muted" numberOfLines={1} style={{ fontSize: 10, width: 40, textAlign: 'center' }}>{b.label}</T> : null}
          </View>
        ))}
      </View>
    </View>
  );
}
