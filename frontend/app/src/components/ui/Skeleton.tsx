import React, { useEffect, useRef } from 'react';
import { Animated, Easing, StyleProp, StyleSheet, View, ViewStyle } from 'react-native';
import { colors, radius, shadow, spacing } from '../../utils/theme';

/**
 * Placeholder shapes shown while a list's rows are on their way. They take
 * the layout of the real rows, so the screen doesn't jump when data arrives
 * the way it did with a lone spinner in the middle.
 *
 * One shared pulse drives every block on screen, so the placeholders breathe
 * together rather than flickering out of step. Opacity runs on the native
 * driver and costs the JS thread nothing while data is loading.
 */
const pulse = new Animated.Value(0.45);
let running = 0;
let loop: Animated.CompositeAnimation | null = null;

const usePulse = () => {
  useEffect(() => {
    running += 1;
    if (running === 1) {
      loop = Animated.loop(
        Animated.sequence([
          Animated.timing(pulse, { toValue: 1, duration: 700, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
          Animated.timing(pulse, { toValue: 0.45, duration: 700, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        ])
      );
      loop.start();
    }
    return () => {
      running -= 1;
      if (running === 0) {
        loop?.stop();
        loop = null;
      }
    };
  }, []);
  return pulse;
};

export function SkeletonBlock({
  width = '100%',
  height = 12,
  rounded = radius.sm,
  style,
}: {
  width?: number | `${number}%`;
  height?: number;
  rounded?: number;
  style?: StyleProp<ViewStyle>;
}) {
  const opacity = usePulse();
  return <Animated.View style={[styles.block, { width, height, borderRadius: rounded, opacity }, style]} />;
}

type Variant = 'media' | 'text' | 'compact';

/**
 * One placeholder row, shaped like the real card it stands in for.
 * - media: a thumbnail on the left (products, subcategories, orders)
 * - text: an icon and two lines (audit log, invoices)
 * - compact: a single line and a trailing value
 */
export function SkeletonRow({ variant = 'media' }: { variant?: Variant }) {
  if (variant === 'compact') {
    return (
      <View style={styles.card}>
        <View style={styles.flex}>
          <SkeletonBlock width="55%" height={13} />
          <SkeletonBlock width="35%" height={10} style={styles.gap} />
        </View>
        <SkeletonBlock width={56} height={14} />
      </View>
    );
  }
  return (
    <View style={styles.card}>
      {variant === 'media' ? (
        <SkeletonBlock width={54} height={54} rounded={radius.md} />
      ) : (
        <SkeletonBlock width={40} height={40} rounded={radius.pill} />
      )}
      <View style={styles.flex}>
        <SkeletonBlock width="70%" height={13} />
        <SkeletonBlock width="45%" height={10} style={styles.gap} />
        {variant === 'media' ? <SkeletonBlock width={70} height={16} rounded={radius.pill} style={styles.gap} /> : null}
      </View>
    </View>
  );
}

/** A stack of placeholder rows — the first-load state of a list. */
export function SkeletonList({ count = 6, variant = 'media' }: { count?: number; variant?: Variant }) {
  return (
    <View accessibilityLabel="Loading" accessibilityRole="progressbar">
      {Array.from({ length: count }, (_, i) => (
        <SkeletonRow key={i} variant={variant} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  block: { backgroundColor: colors.placeholderBg },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: spacing.sm,
    ...shadow.card,
  },
  flex: { flex: 1, minWidth: 0 },
  gap: { marginTop: spacing.sm },
});
