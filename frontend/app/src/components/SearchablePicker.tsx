import React, { useMemo, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../utils/theme';

interface PickerItem {
  id: string;
  name: string;
}

interface Props {
  items: PickerItem[];
  selectedId: string;
  onSelect: (id: string) => void;
  searchPlaceholder: string;
  emptyText?: string;
  maxVisibleRows?: number;
  /**
   * The ones picked here recently, newest first — shown above the list while
   * the search box is empty, so going back to the same subcategory is one
   * tap instead of typing it again. Left out (the default) on pickers that
   * don't keep recents.
   */
  recents?: PickerItem[];
  onClearRecents?: () => void;
}

const ROW_HEIGHT = 46;

// Replaces free-wrapping chip rows for category/subcategory selection —
// wrapped chips go ragged once there are more than a handful (variable text
// width means uneven row breaks). This keeps every row the same height in a
// bounded, scrollable list, with a search box to jump straight to one out of
// a long list, and plain scrolling still available for manual browsing.
export default function SearchablePicker({
  items,
  selectedId,
  onSelect,
  searchPlaceholder,
  emptyText,
  maxVisibleRows = 5,
  recents,
  onClearRecents,
}: Props) {
  const [query, setQuery] = useState('');

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items;
    return items.filter((item) => item.name.toLowerCase().includes(q));
  }, [items, query]);

  // Anything renamed or removed since it was picked is dropped, so a recent
  // row always matches a real row in the list below it.
  const visibleRecents = useMemo(() => {
    if (!recents?.length || query.trim()) return [];
    return recents
      .map((recent) => items.find((item) => item.id === recent.id))
      .filter((item): item is PickerItem => Boolean(item));
  }, [recents, items, query]);

  const selected = items.find((item) => item.id === selectedId);
  const visibleRows = Math.max(1, Math.min(filtered.length || 1, maxVisibleRows));

  return (
    <View style={styles.wrap}>
      <View style={styles.searchRow}>
        <Ionicons name="search" size={15} color={colors.textMuted} />
        <TextInput
          style={styles.searchInput}
          value={query}
          onChangeText={setQuery}
          placeholder={searchPlaceholder}
          placeholderTextColor={colors.textMuted}
          autoCapitalize="none"
        />
        {query.length > 0 && (
          <TouchableOpacity onPress={() => setQuery('')} hitSlop={8}>
            <Ionicons name="close-circle" size={16} color={colors.textMuted} />
          </TouchableOpacity>
        )}
      </View>

      {visibleRecents.length > 0 && (
        <View style={styles.recents}>
          <View style={styles.recentsHeader}>
            <Text style={styles.recentsTitle}>Recent searches</Text>
            {onClearRecents && (
              <TouchableOpacity onPress={onClearRecents} hitSlop={10}>
                <Text style={styles.recentsClear}>Clear</Text>
              </TouchableOpacity>
            )}
          </View>
          {visibleRecents.map((item) => (
            <TouchableOpacity
              key={item.id}
              style={styles.recentRow}
              onPress={() => onSelect(item.id)}
              activeOpacity={0.7}
            >
              <Ionicons name="time-outline" size={15} color={colors.textMuted} />
              <Text style={styles.recentText} numberOfLines={1}>{item.name}</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {selected && (
        <View style={styles.selectedRow}>
          <Ionicons name="checkmark-circle" size={13} color={colors.primary} />
          <Text style={styles.selectedText} numberOfLines={1}>Selected: {selected.name}</Text>
        </View>
      )}

      <ScrollView
        style={[styles.list, { maxHeight: visibleRows * ROW_HEIGHT }]}
        nestedScrollEnabled
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {filtered.length === 0 ? (
          <Text style={styles.empty}>{emptyText || 'No matches found'}</Text>
        ) : (
          filtered.map((item, index) => {
            const isSelected = item.id === selectedId;
            const isLast = index === filtered.length - 1;
            return (
              <TouchableOpacity
                key={item.id}
                style={[styles.row, isSelected && styles.rowActive, isLast && styles.rowLast]}
                onPress={() => onSelect(item.id)}
              >
                <Text style={[styles.rowText, isSelected && styles.rowTextActive]} numberOfLines={1}>
                  {item.name}
                </Text>
                {isSelected && <Ionicons name="checkmark" size={16} color="#fff" />}
              </TouchableOpacity>
            );
          })
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginTop: 4 },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 9,
    backgroundColor: '#fff',
  },
  searchInput: { flex: 1, fontSize: 13, color: colors.text, padding: 0 },
  recents: {
    marginTop: 8,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    backgroundColor: '#fff',
    paddingVertical: 4,
  },
  recentsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingTop: 6,
    paddingBottom: 2,
  },
  recentsTitle: { fontSize: 11, color: colors.textLabel, fontWeight: '700', letterSpacing: 0.3 },
  recentsClear: { fontSize: 12, color: colors.primary, fontWeight: '700' },
  recentRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 14, paddingVertical: 9 },
  recentText: { fontSize: 13, color: colors.text, fontWeight: '600', flex: 1 },
  selectedRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8 },
  selectedText: { fontSize: 12, color: colors.primary, fontWeight: '700', flexShrink: 1 },
  list: {
    marginTop: 8,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    backgroundColor: '#fff',
  },
  empty: { fontSize: 12, color: colors.textMuted, padding: 14, textAlign: 'center' },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  rowLast: { borderBottomWidth: 0 },
  rowActive: { backgroundColor: colors.primary },
  rowText: { fontSize: 14, color: colors.text, fontWeight: '600', flexShrink: 1 },
  rowTextActive: { color: '#fff', fontWeight: '700' },
});
