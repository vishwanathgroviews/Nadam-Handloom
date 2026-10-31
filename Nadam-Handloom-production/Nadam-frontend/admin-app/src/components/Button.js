// Buttons: at least 48 pt tall, a press animation, a spinner while busy.
import { useState } from 'react';
import { ActivityIndicator, Animated, Pressable, StyleSheet, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import { useTheme } from '../theme/ThemeProvider';
import { Icon } from './Icon';
import { T } from './T';

export function Button({ title, onPress, kind = 'primary', icon, loading = false, disabled = false, small = false, style, accessibilityLabel }) {
  const { c, radius } = useTheme();
  const [scale] = useState(() => new Animated.Value(1)); // created once, never re-created on render
  const look = {
    primary: { bg: c.primary, fg: c.onPrimary, border: c.primary },
    secondary: { bg: c.surface, fg: c.text, border: c.borderStrong },
    ghost: { bg: 'transparent', fg: c.primary, border: 'transparent' },
    danger: { bg: 'transparent', fg: c.danger, border: c.danger },
    dangerSolid: { bg: c.danger, fg: c.onDanger, border: c.danger },
    whatsapp: { bg: '#25D366', fg: '#06341A', border: '#25D366' }, // WhatsApp's own green, only for "Share on WhatsApp"
  }[kind];
  const inactive = disabled || loading;
  const press = (to) => Animated.spring(scale, { toValue: to, useNativeDriver: true, speed: 40, bounciness: 0 }).start();
  return (
    <Animated.View style={[{ transform: [{ scale }] }, style]}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel || title}
        accessibilityState={{ disabled: inactive, busy: loading }}
        disabled={inactive}
        onPressIn={() => press(0.97)}
        onPressOut={() => press(1)}
        onPress={() => {
          Haptics.selectionAsync().catch(() => {});
          onPress?.();
        }}
        style={[styles.base, { minHeight: small ? 38 : 50, paddingHorizontal: small ? 14 : 20, borderRadius: small ? radius.sm : radius.md, backgroundColor: look.bg, borderColor: look.border, opacity: disabled ? 0.45 : 1 }]}
      >
        {loading ? (
          <ActivityIndicator color={look.fg} />
        ) : (
          <View style={styles.row}>
            {icon ? <Icon name={icon} size={small ? 17 : 20} color={look.fg} /> : null}
            <T variant={small ? 'smallStrong' : 'bodyStrong'} color={look.fg}>{title}</T>
          </View>
        )}
      </Pressable>
    </Animated.View>
  );
}

export function LinkButton({ title, onPress, color = 'primary', style }) {
  const { c } = useTheme();
  return (
    <Pressable accessibilityRole="button" onPress={onPress} hitSlop={10} style={style}>
      <T variant="smallStrong" style={{ color: c[color] || color, textDecorationLine: 'underline' }}>{title}</T>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: { borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
});
