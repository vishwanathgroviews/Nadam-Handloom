import React from 'react';
import { View, StyleProp, ViewStyle, StyleSheet } from 'react-native';
import { colors, radius, shadow, spacing } from '../../utils/theme';

interface Props {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}

// White, border-free, soft-shadow surface — the dominant container shape in
// the source design (rows, sections, forms all sit on this).
export default function Card({ children, style }: Props) {
  return <View style={[styles.card, style]}>{children}</View>;
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    padding: spacing.md,
    ...shadow.card,
  },
});
