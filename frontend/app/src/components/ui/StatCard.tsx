import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius, shadow, spacing, typography } from '../../utils/theme';

interface Props {
  icon?: keyof typeof Ionicons.glyphMap;
  iconColor?: string;
  iconBg?: string;
  label: string;
  /**
   * Left out on tiles that stand for a place to go rather than a figure —
   * the home screen's To ship / Shipped pair. The label is then the
   * prominent wording in the card, with no number above it.
   */
  value?: string | number;
  valueColor?: string;
}

// Quick-stat tile: white card, optional icon circle, a big number, muted
// label underneath — used for Analytics' Orders / Avg order tiles. Without
// a `value` it becomes a plain labelled tile, which is what the home
// screen's To ship / Shipped pair use.
export default function StatCard({ icon, iconColor, iconBg, label, value, valueColor }: Props) {
  return (
    <View style={styles.card}>
      {icon && (
        <View style={[styles.iconWrap, { backgroundColor: iconBg }]}>
          <Ionicons name={icon} size={19} color={iconColor} />
        </View>
      )}
      {value === undefined ? (
        <Text
          style={[typography.h2, styles.headline]}
          numberOfLines={1}
          adjustsFontSizeToFit
          minimumFontScale={0.8}
        >
          {label}
        </Text>
      ) : (
        <>
          <Text style={[typography.amount, styles.value, valueColor ? { color: valueColor } : null]}>{value}</Text>
          <Text style={[typography.bodySm, styles.label]}>{label}</Text>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1, backgroundColor: colors.surface, borderRadius: radius.lg,
    padding: spacing.lg, ...shadow.card,
  },
  iconWrap: { width: 38, height: 38, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center', marginBottom: spacing.md },
  value: { color: colors.text, marginTop: 2 },
  label: { color: colors.textMuted, marginTop: 1 },
  headline: { color: colors.text, marginTop: 2 },
});
