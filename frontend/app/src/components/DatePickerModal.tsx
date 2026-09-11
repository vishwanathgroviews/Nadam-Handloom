import React, { useMemo, useState } from 'react';
import { Modal, View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius, spacing, typography } from '../utils/theme';

interface Props {
  visible: boolean;
  title?: string;
  /** Currently selected day, as YYYY-MM-DD. Blank opens on today's month. */
  value?: string;
  /** Days after this are not selectable — used to stop a range ending in the future. */
  maximumDate?: Date;
  /** Days before this are not selectable — used to stop "to" preceding "from". */
  minimumDate?: Date;
  onSelect: (isoDate: string) => void;
  onClose: () => void;
}

const WEEKDAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

/** Local-time YYYY-MM-DD — deliberately not toISOString(), which shifts to UTC and can land on the previous day. */
export const toIsoDate = (date: Date): string => {
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
};

const startOfDay = (date: Date): Date => new Date(date.getFullYear(), date.getMonth(), date.getDate());

const parseIsoDate = (value?: string): Date | null => {
  if (!value) return null;
  const [year, month, day] = value.split('-').map(Number);
  if (!year || !month || !day) return null;
  const parsed = new Date(year, month - 1, day);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

/**
 * A plain month-grid date picker. Built from React Native primitives rather
 * than pulling in a native date-picker module: this app ships through Expo
 * Go as well as EAS builds, and a JS-only picker needs no rebuild and looks
 * identical on both platforms.
 */
export default function DatePickerModal({
  visible, title = 'Select date', value, maximumDate, minimumDate, onSelect, onClose,
}: Props) {
  const selected = parseIsoDate(value);
  const [cursor, setCursor] = useState(() => selected ?? new Date());

  // Re-anchor the grid whenever the field being edited changes underneath us
  // (e.g. opening "To" after having opened "From" on a different month).
  const anchorKey = value ?? '';
  const [lastAnchor, setLastAnchor] = useState(anchorKey);
  if (anchorKey !== lastAnchor) {
    setLastAnchor(anchorKey);
    setCursor(selected ?? new Date());
  }

  const { days, monthLabel } = useMemo(() => {
    const year = cursor.getFullYear();
    const month = cursor.getMonth();
    const firstWeekday = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    // Leading blanks line day 1 up under its real weekday column.
    const cells: (Date | null)[] = Array(firstWeekday).fill(null);
    for (let day = 1; day <= daysInMonth; day++) cells.push(new Date(year, month, day));
    return { days: cells, monthLabel: `${MONTHS[month]} ${year}` };
  }, [cursor]);

  const isDisabled = (date: Date): boolean => {
    const day = startOfDay(date);
    if (maximumDate && day > startOfDay(maximumDate)) return true;
    if (minimumDate && day < startOfDay(minimumDate)) return true;
    return false;
  };

  const todayIso = toIsoDate(new Date());

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={onClose}>
        {/* Swallows taps inside the sheet so they don't dismiss it. */}
        <TouchableOpacity style={styles.sheet} activeOpacity={1}>
          <View style={styles.header}>
            <Text style={styles.title}>{title}</Text>
            <TouchableOpacity onPress={onClose} hitSlop={8}>
              <Ionicons name="close" size={22} color={colors.text} />
            </TouchableOpacity>
          </View>

          <View style={styles.monthRow}>
            <TouchableOpacity
              onPress={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1))}
              hitSlop={10}
              style={styles.monthArrow}
            >
              <Ionicons name="chevron-back" size={20} color={colors.primary} />
            </TouchableOpacity>
            <Text style={styles.monthLabel}>{monthLabel}</Text>
            <TouchableOpacity
              onPress={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1))}
              hitSlop={10}
              style={styles.monthArrow}
            >
              <Ionicons name="chevron-forward" size={20} color={colors.primary} />
            </TouchableOpacity>
          </View>

          <View style={styles.weekRow}>
            {WEEKDAYS.map((label, i) => (
              <Text key={`${label}-${i}`} style={styles.weekday}>{label}</Text>
            ))}
          </View>

          <View style={styles.grid}>
            {days.map((date, index) => {
              if (!date) return <View key={`blank-${index}`} style={styles.dayCell} />;
              const iso = toIsoDate(date);
              const disabled = isDisabled(date);
              const isSelected = iso === value;
              return (
                <TouchableOpacity
                  key={iso}
                  style={styles.dayCell}
                  disabled={disabled}
                  activeOpacity={0.7}
                  onPress={() => {
                    onSelect(iso);
                    onClose();
                  }}
                >
                  <View style={[styles.dayInner, isSelected && styles.daySelected]}>
                    <Text
                      style={[
                        styles.dayText,
                        disabled && styles.dayTextDisabled,
                        iso === todayIso && !isSelected && styles.dayTextToday,
                        isSelected && styles.dayTextSelected,
                      ]}
                    >
                      {date.getDate()}
                    </Text>
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>

          <TouchableOpacity
            style={styles.todayButton}
            onPress={() => {
              const now = new Date();
              if (!isDisabled(now)) {
                onSelect(toIsoDate(now));
                onClose();
              }
            }}
            activeOpacity={0.8}
          >
            <Text style={styles.todayButtonText}>Today</Text>
          </TouchableOpacity>
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center', justifyContent: 'center', padding: spacing.lg,
  },
  sheet: {
    width: '100%', maxWidth: 360, backgroundColor: colors.surface,
    borderRadius: radius.xl, padding: spacing.lg,
  },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: { ...typography.bodySemibold, fontSize: 16, color: colors.text },
  monthRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    marginTop: spacing.md, marginBottom: spacing.sm,
  },
  monthArrow: {
    width: 34, height: 34, borderRadius: radius.pill, backgroundColor: colors.primaryBg,
    alignItems: 'center', justifyContent: 'center',
  },
  monthLabel: { ...typography.bodySemibold, fontSize: 15, color: colors.text },
  weekRow: { flexDirection: 'row', marginTop: spacing.sm },
  weekday: {
    flex: 1, textAlign: 'center', ...typography.bodySm,
    fontSize: 11, color: colors.textLabel,
  },
  grid: { flexDirection: 'row', flexWrap: 'wrap', marginTop: spacing.xs },
  // Seven columns; the fixed aspect ratio keeps rows square without measuring.
  dayCell: { width: `${100 / 7}%`, aspectRatio: 1, alignItems: 'center', justifyContent: 'center' },
  dayInner: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  daySelected: { backgroundColor: colors.primary },
  dayText: { ...typography.body, fontSize: 14, color: colors.text },
  dayTextDisabled: { color: colors.iconMuted },
  dayTextToday: { color: colors.primary, fontWeight: '700' },
  dayTextSelected: { color: '#fff', fontWeight: '700' },
  todayButton: {
    marginTop: spacing.md, alignSelf: 'center',
    paddingVertical: spacing.sm, paddingHorizontal: spacing.xl,
    borderRadius: radius.pill, backgroundColor: colors.inputBg,
  },
  todayButtonText: { ...typography.bodySmSemibold, color: colors.primary },
});
