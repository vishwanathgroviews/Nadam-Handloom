import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius, shadow, spacing, typography } from '../../utils/theme';

interface Props {
  icon?: keyof typeof Ionicons.glyphMap;
  iconColor?: string;
  iconBg?: string;
  label: string;
  value: string | number;
  valueColor?: string;
}

// Quick-stat tile: white card, optional icon circle, a big number, muted
// label underneath — used for the home screen's "running low / to ship"
// pair and Analytics' Orders / Avg order tiles.
export default function StatCard({ icon, iconColor, iconBg, label, value, valueColor }: Props) {
  return (
    <View style={styles.card}>
      {icon && (
        <View style={[styles.iconWrap, { backgroundColor: iconBg }]}>
          <Ionicons name={icon} size={19} color={iconColor} />
        </View>
      )}
      <Text style={[typography.amount, styles.value, valueColor ? { color: valueColor } : null]}>{value}</Text>
      <Text style={[typography.bodySm, styles.label]}>{label}</Text>
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
});
