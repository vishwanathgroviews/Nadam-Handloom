// Rows / photo grid switch above product lists (owner's pick, Module 4 section 6B).
// The phone remembers the choice, like the theme.
import { useEffect, useState } from 'react';
import { Pressable, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTheme } from '../../theme/ThemeProvider';
import { Icon } from '../Icon';
import { T } from '../T';

const KEY = 'nandam.products.view';
let remembered = 'rows';
const listeners = new Set();
AsyncStorage.getItem(KEY).then((v) => { if (v === 'grid') { remembered = 'grid'; listeners.forEach((l) => l(v)); } }).catch(() => {});

export function useListView() {
  const [view, setView] = useState(remembered);
  useEffect(() => { listeners.add(setView); return () => listeners.delete(setView); }, []);
  const choose = (v) => { remembered = v; AsyncStorage.setItem(KEY, v).catch(() => {}); listeners.forEach((l) => l(v)); };
  return [view, choose];
}

export function ListHead({ label, view, onView }) {
  const { c, radius } = useTheme();
  const btn = (key, icon, name) => {
    const on = view === key;
    return (
      <Pressable key={key} accessibilityRole="button" accessibilityLabel={name} accessibilityState={{ selected: on }} onPress={() => onView(key)} hitSlop={4}
        style={{ width: 38, height: 32, borderRadius: radius.sm - 3, alignItems: 'center', justifyContent: 'center', backgroundColor: on ? c.surface : 'transparent' }}>
        <Icon name={icon} size={18} color={on ? c.primary : c.muted} />
      </Pressable>
    );
  };
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8, gap: 10 }}>
      <T variant="smallStrong" color="muted" style={{ flex: 1 }} numberOfLines={1}>{label}</T>
      <View style={{ flexDirection: 'row', padding: 3, gap: 2, borderRadius: radius.sm, backgroundColor: c.surface2, borderWidth: 1, borderColor: c.border }}>
        {btn('rows', 'list', 'Rows with photo')}
        {btn('grid', 'grid', 'Photo grid')}
      </View>
    </View>
  );
}
