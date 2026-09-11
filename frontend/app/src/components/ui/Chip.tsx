import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { colors, radius, shadow, spacing, typography } from '../../utils/theme';

type Tone = 'neutral' | 'primary' | 'success' | 'warning' | 'error';

const TONE_BG: Record<Tone, string> = {
  neutral: colors.placeholderBg,
  primary: colors.primaryBg,
  success: colors.successBg,
  warning: colors.warningBg,
  error: colors.errorBg,
};
const TONE_TEXT: Record<Tone, string> = {
  neutral: colors.textMuted,
  primary: colors.primary,
  success: colors.success,
  warning: colors.warning,
  error: colors.error,
};

// Static status pill (order/stock status, roles, audit tags).
export function Badge({ label, tone = 'neutral' }: { label: string; tone?: Tone }) {
  return (
    <View style={[styles.badge, { backgroundColor: TONE_BG[tone] }]}>
      <Text style={[styles.badgeText, { color: TONE_TEXT[tone] }]}>{label}</Text>
    </View>
  );
}

// Standalone toggle chip — dark-fill when active, soft tan when not (matches
// the source design's date-filter chips).
export function FilterChip({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <TouchableOpacity style={[styles.chip, active && styles.chipActive]} onPress={onPress} activeOpacity={0.8}>
      <Text style={[styles.chipText, active && styles.chipTextActive]}>{label}</Text>
    </TouchableOpacity>
  );
}

// Pill-tracked segmented control (Orders tabs, Analytics ranges, Scanner
// mode) — the active segment floats as a white, shadowed tile.
export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { key: T; label: string }[];
  value: T;
  onChange: (key: T) => void;
}) {
  return (
    <View style={styles.track}>
      {options.map((opt) => {
        const active = opt.key === value;
        return (
          <TouchableOpacity
            key={opt.key}
            style={[styles.segment, active && styles.segmentActive]}
            onPress={() => onChange(opt.key)}
            activeOpacity={0.8}
          >
            <Text style={[styles.segmentText, active && styles.segmentTextActive]} numberOfLines={1}>{opt.label}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    borderRadius: radius.pill,
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: 4,
    alignSelf: 'flex-start',
  },
  badgeText: { ...typography.micro },
  chip: {
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: 8,
    backgroundColor: colors.segmentTrack,
    alignItems: 'center',
  },
  chipActive: { backgroundColor: colors.text },
  chipText: { ...typography.bodySmSemibold, color: colors.textMuted },
  chipTextActive: { color: '#fff' },
  track: {
    flexDirection: 'row', gap: spacing.sm, backgroundColor: colors.segmentTrack,
    borderRadius: radius.pill, padding: 4,
  },
  segment: { flex: 1, alignItems: 'center', paddingVertical: spacing.sm + 1, borderRadius: radius.pill },
  segmentActive: { backgroundColor: colors.surface, ...shadow.card },
  segmentText: { ...typography.bodySmSemibold, color: colors.textMuted },
  segmentTextActive: { color: colors.text },
});
