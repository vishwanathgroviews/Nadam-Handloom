import React from 'react';
import { TouchableOpacity, Text, ActivityIndicator, StyleProp, ViewStyle, StyleSheet } from 'react-native';
import { colors, radius, spacing, shadow, typography } from '../../utils/theme';

type Variant = 'primary' | 'secondary' | 'destructive';

interface Props {
  title: string;
  onPress: () => void;
  variant?: Variant;
  loading?: boolean;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
}

// Full-pill buttons: primary is solid maroon with a matching glow, secondary
// is a soft tan fill (no border), destructive is solid error red.
export default function Button({ title, onPress, variant = 'primary', loading = false, disabled = false, style }: Props) {
  const isDisabled = disabled || loading;
  return (
    <TouchableOpacity
      style={[styles.base, styles[variant], isDisabled && styles.disabled, style]}
      onPress={onPress}
      disabled={isDisabled}
      activeOpacity={0.85}
    >
      {loading ? (
        <ActivityIndicator size="small" color={variant === 'secondary' ? colors.primary : '#fff'} />
      ) : (
        <Text style={[styles.text, variant === 'secondary' && styles.textSecondary]}>{title}</Text>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: radius.pill,
    paddingVertical: spacing.md + 3,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
  },
  primary: { backgroundColor: colors.primary, ...shadow.brand },
  secondary: { backgroundColor: colors.inputBg },
  destructive: { backgroundColor: colors.error },
  disabled: { opacity: 0.5 },
  text: { ...typography.button, color: '#fff' },
  textSecondary: { color: colors.text },
});
