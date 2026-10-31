// Custom dates (6.8): tap the first day, then the last. Whole days in India time; no
// days after today. Weeks start on Monday.
import { useState } from 'react';
import { Modal, Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../theme/ThemeProvider';
import { Button } from '../Button';
import { Icon } from '../Icon';
import { T } from '../T';
import { addMonths, dayLabel, monthGrid, monthLabel, pickDay, todayIst } from '../../utils/invoices';

export function CalendarModal({ visible, initial, onClose, onUse, title = 'Custom dates' }) {
  const { c, radius } = useTheme();
  const insets = useSafeAreaInsets();
  const [range, setRange] = useState(initial || null);
  const [view, setView] = useState((initial?.from || todayIst()).slice(0, 7));
  const label = !range?.from ? 'Tap the first day' : range.to && range.to !== range.from ? `${dayLabel(range.from)} – ${dayLabel(range.to)}` : `${dayLabel(range.from)}${range.to ? '' : ' · tap the last day'}`;
  const inRange = (ymd) => range?.from && range?.to && ymd > range.from && ymd < range.to;
  const isEnd = (ymd) => ymd === range?.from || ymd === range?.to;
  const atLatest = view >= todayIst().slice(0, 7);
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <Pressable onPress={onClose} style={{ flex: 1, backgroundColor: c.overlay, justifyContent: 'flex-end', padding: 12, paddingBottom: Math.max(insets.bottom, 12) }}>
        <Pressable onPress={() => {}} style={{ backgroundColor: c.surface, borderRadius: radius.xl, padding: 18, width: '100%', maxWidth: 460, alignSelf: 'center' }}>
          <T variant="barTitle">{title}</T>
          <T variant="smallStrong" color="primary" style={{ marginTop: 4 }} accessibilityLiveRegion="polite">{label}</T>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 10 }}>
            <Pressable accessibilityRole="button" accessibilityLabel="Previous month" onPress={() => setView((v) => addMonths(v, -1))} hitSlop={8} style={{ width: 40, height: 40, alignItems: 'center', justifyContent: 'center' }}><Icon name="back" color={c.text} /></Pressable>
            <T variant="bodyStrong">{monthLabel(view)}</T>
            <Pressable accessibilityRole="button" accessibilityLabel="Next month" disabled={atLatest} onPress={() => setView((v) => addMonths(v, 1))} hitSlop={8} style={{ width: 40, height: 40, alignItems: 'center', justifyContent: 'center', opacity: atLatest ? 0.3 : 1, transform: [{ rotate: '180deg' }] }}><Icon name="back" color={c.text} /></Pressable>
          </View>
          <View style={{ flexDirection: 'row' }}>
            {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((d, i) => <T key={i} variant="caption" color="muted" style={{ flex: 1, textAlign: 'center', paddingVertical: 4 }}>{d}</T>)}
          </View>
          {monthGrid(view).map((week, wi) => (
            <View key={wi} style={{ flexDirection: 'row' }}>
              {week.map((d, di) => {
                if (!d) return <View key={di} style={{ flex: 1, aspectRatio: 1 }} />;
                const end = isEnd(d.ymd);
                const mid = inRange(d.ymd);
                return (
                  <Pressable key={d.ymd} disabled={d.future} accessibilityRole="button" accessibilityLabel={dayLabel(d.ymd)} accessibilityState={{ selected: end, disabled: d.future }}
                    onPress={() => setRange((r) => pickDay(r, d.ymd))}
                    style={{ flex: 1, aspectRatio: 1, margin: 1, borderRadius: mid ? 0 : radius.md, alignItems: 'center', justifyContent: 'center', backgroundColor: end ? c.primary : mid ? c.primarySoft : 'transparent', borderWidth: d.today && !end ? 1.5 : 0, borderColor: c.primary, opacity: d.future ? 0.3 : 1 }}>
                    <T variant="smallStrong" color={end ? c.onPrimary : 'text'}>{d.day}</T>
                  </Pressable>
                );
              })}
            </View>
          ))}
          <T variant="caption" color="muted" style={{ marginTop: 8 }}>Whole days in India time: from 00:00 on the first day to 23:59 on the last.</T>
          <View style={{ gap: 8, marginTop: 12 }}>
            <Button title="Use these dates" disabled={!range?.from} onPress={() => onUse({ from: range.from, to: range.to || range.from })} />
            <Button title="Cancel" kind="ghost" onPress={onClose} />
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
