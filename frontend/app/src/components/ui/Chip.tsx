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
export function FilterChip({
  label,
  active,
  onPress,
  fill = false,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
  /**
   * Share the row equally with the other chips and keep the label on one
   * line (shrinking it slightly if it must), so a fixed set of chips always
   * sits on a single row instead of wrapping on a narrow phone.
   */
  fill?: boolean;
}) {
  return (
    <TouchableOpacity
      style={[styles.chip, fill && styles.chipFill, active && styles.chipActive]}
      onPress={onPress}
      activeOpacity={0.8}
    >
      <Text
        style={[styles.chipText, active && styles.chipTextActive]}
        numberOfLines={fill ? 1 : undefined}
        adjustsFontSizeToFit={fill}
        minimumFontScale={0.8}
      >
        {label}
      </Text>
    </TouchableOpacity>
  );
}

// Pill-tracked segmented control (Orders tabs, Analytics ranges, Scanner
// mode) — the active segment floats as a white, shadowed tile.
export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  invalid = false,
}: {
  options: { key: T; label: string }[];
  /** null = nothing chosen yet; no segment is highlighted. */
  value: T | null;
  onChange: (key: T) => void;
  /** Outlines the control in the error colour when a required choice was skipped. */
  invalid?: boolean;
}) {
  return (
    <View
      style={[styles.track, invalid && styles.trackInvalid]}
      accessibilityRole="radiogroup"
    >
      {options.map((opt) => {
        const active = opt.key === value;
        return (
          <TouchableOpacity
            key={opt.key}
            style={[styles.segment, active && styles.segmentActive]}
            onPress={() => onChange(opt.key)}
            activeOpacity={0.8}
            accessibilityRole="radio"
            accessibilityState={{ selected: active }}
          >
            <Text style={[styles.segmentText, active && styles.segmentTextActive]} numberOfLines={1}>{opt.label}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  trackInvalid: { borderWidth: 1.5, borderColor: colors.error },
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
  chipFill: { flex: 1, alignItems: 'center', paddingHorizontal: spacing.xs },
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
