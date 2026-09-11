import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors, radius, spacing, typography } from '../utils/theme';

export default function OfflineBanner({ cachedAt }: { cachedAt?: string | null }) {
  return (
    <View style={styles.banner}>
      <Text style={styles.text}>
        Offline — showing saved data{cachedAt ? ` from ${new Date(cachedAt).toLocaleString()}` : ''}.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    backgroundColor: colors.warningBg,
    borderRadius: radius.md,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    marginBottom: spacing.md,
  },
  text: { ...typography.bodySmSemibold, color: colors.warning },
});
