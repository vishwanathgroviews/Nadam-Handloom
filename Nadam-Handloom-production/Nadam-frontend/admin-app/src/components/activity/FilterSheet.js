// Everything in one Filter sheet (Module 10, pick B): kind, person, period (any dates
// opens the calendar), Important only. "Show" applies; "Clear filters" goes back to all.
import { useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Switch, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../theme/ThemeProvider';
import { Button } from '../Button';
import { T } from '../T';
import { CalendarModal } from '../invoices/CalendarModal';
import { DEFAULT_VIEW, KINDS, PERIODS } from '../../utils/activity';

function Chips({ items, value, onChange }) {
  const { c, radius } = useTheme();
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
      {items.map(([k, label]) => {
        const on = value === k;
        return (
          <Pressable key={String(k)} accessibilityRole="radio" accessibilityState={{ selected: on }} onPress={() => onChange(k, label)}
            style={{ minHeight: 36, paddingHorizontal: 13, justifyContent: 'center', borderRadius: radius.pill, borderWidth: 1, borderColor: on ? c.primary : c.borderStrong, backgroundColor: on ? c.primary : c.surface }}>
            <T variant="smallStrong" color={on ? c.onPrimary : c.text2}>{label}</T>
          </Pressable>
        );
      })}
    </View>
  );
}

// people: the first 20 (and more with morePeople, 20 at a time).
export function FilterSheet({ view, people, morePeople, loadingPeople, onApply, onClose }) {
  const { c, radius } = useTheme();
  const insets = useSafeAreaInsets();
  const [d, setD] = useState(view);
  const [calendar, setCalendar] = useState(false);
  const set = (patch) => setD((x) => ({ ...x, ...patch }));
  const label = (t) => <T variant="label" color="muted" style={{ marginTop: 6 }}>{t}</T>;
  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <View style={{ flex: 1, backgroundColor: c.overlay, justifyContent: 'flex-end', padding: 12, paddingBottom: Math.max(insets.bottom, 12) }}>
        {/* The dark background closes the sheet; it sits behind the sheet, so drags inside the sheet always scroll it. */}
        <Pressable accessibilityLabel="Close" onPress={onClose} style={StyleSheet.absoluteFill} />
        <View style={{ backgroundColor: c.surface, borderRadius: radius.xl, padding: 18, width: '100%', maxWidth: 520, alignSelf: 'center', maxHeight: '88%' }}>
          <ScrollView contentContainerStyle={{ gap: 10 }} style={{ flexShrink: 1 }}>
            <T variant="barTitle">Filter</T>
            {label('Kind')}
            <Chips items={KINDS} value={d.kind} onChange={(k) => set({ kind: k })} />
            {label('Person')}
            <Chips items={[[null, 'Everyone'], ...(people || []).map((p) => [p.id, p.role === 'former' ? `${p.name} (former)` : p.name])]} value={d.person} onChange={(k, name) => set({ person: k, personName: k ? name : null })} />
            {morePeople ? <Button title="More people" kind="ghost" small loading={loadingPeople} onPress={morePeople} style={{ alignSelf: 'flex-start' }} /> : null}
            {label('Period')}
            <Chips items={PERIODS.map(([k, l]) => [k, k === 'custom' && d.period === 'custom' && d.custom ? `${d.custom.from} – ${d.custom.to}` : l])} value={d.period} onChange={(k) => (k === 'custom' ? setCalendar(true) : set({ period: k, custom: null }))} />
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 8 }}>
              <View style={{ flex: 1 }}>
                <T variant="smallStrong">Important only</T>
                <T variant="caption" color="muted">Price changes, cancellations, big bargains, deletions, new phones, locked PINs</T>
              </View>
              <Switch value={d.important} onValueChange={(v) => set({ important: v })} trackColor={{ true: c.primary, false: c.surface3 }} accessibilityLabel="Important only" />
            </View>
          </ScrollView>
          {/* Always in view, however long the lists above are. */}
          <View style={{ gap: 8, paddingTop: 12 }}>
            <Button title="Show" onPress={() => onApply(d)} />
            <Button title="Clear filters" kind="secondary" onPress={() => onApply({ ...DEFAULT_VIEW })} />
          </View>
        </View>
      </View>
      {calendar ? <CalendarModal visible title="Any dates" initial={d.custom} onClose={() => setCalendar(false)} onUse={(r) => { set({ period: 'custom', custom: r }); setCalendar(false); }} /> : null}
    </Modal>
  );
}
