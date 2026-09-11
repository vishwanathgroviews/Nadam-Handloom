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
}: Props) {
  const [query, setQuery] = useState('');

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items;
    return items.filter((item) => item.name.toLowerCase().includes(q));
  }, [items, query]);

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
