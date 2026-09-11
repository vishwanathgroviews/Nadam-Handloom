import React, { useEffect, useRef, useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView,
  useWindowDimensions, NativeSyntheticEvent, NativeScrollEvent,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius, shadow, spacing, typography } from '../utils/theme';

type IconName = keyof typeof Ionicons.glyphMap;

export interface QuickAction {
  key: string;
  label: string;
  icon: IconName;
  onPress: () => void;
}

interface Props {
  actions: QuickAction[];
  /** Horizontal padding of the screen the carousel sits in, so each card
   *  spans exactly one page. */
  horizontalPadding?: number;
}

const AUTO_ADVANCE_MS = 3000;

/**
 * The paging Quick Actions carousel: one full-width card at a time,
 * auto-advancing and looping, with a dot for each action.
 *
 * Shared by the Admin and Staff home screens so both stay identical —
 * Staff used to show a row of small chips instead.
 */
export default function QuickActionsCarousel({ actions, horizontalPadding = spacing.md }: Props) {
  const { width: windowWidth } = useWindowDimensions();
  const [index, setIndex] = useState(0);
  const scrollRef = useRef<ScrollView>(null);
  const cardWidth = windowWidth - horizontalPadding * 2;

  // Auto-advance, looping back to the first card. Reset whenever the card
  // width changes (rotation) so the timer's scrollTo offsets stay valid.
  useEffect(() => {
    if (actions.length <= 1) return;
    const timer = setInterval(() => {
      setIndex((prev) => {
        const next = (prev + 1) % actions.length;
        scrollRef.current?.scrollTo({ x: next * cardWidth, animated: true });
        return next;
      });
    }, AUTO_ADVANCE_MS);
    return () => clearInterval(timer);
  }, [actions.length, cardWidth]);

  const handleScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    if (cardWidth <= 0) return;
    const next = Math.round(e.nativeEvent.contentOffset.x / cardWidth);
    setIndex(Math.max(0, Math.min(next, actions.length - 1)));
  };

  return (
    <>
      <ScrollView
        ref={scrollRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={handleScroll}
        scrollEventThrottle={16}
      >
        {actions.map((action) => (
          <TouchableOpacity
            key={action.key}
            style={[styles.quickCard, { width: cardWidth }]}
            onPress={action.onPress}
            activeOpacity={0.8}
          >
            <View style={styles.quickCardIconWrap}>
              <Ionicons name={action.icon} size={20} color={colors.primary} />
            </View>
            <Text style={styles.quickCardText}>{action.label}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
      <View style={styles.quickDotsRow}>
        {actions.map((action, i) => (
          <View key={action.key} style={[styles.quickDot, i === index && styles.quickDotActive]} />
        ))}
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  quickCard: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.md, backgroundColor: colors.surface,
    borderRadius: radius.lg, paddingHorizontal: spacing.lg, paddingVertical: spacing.lg, ...shadow.card,
  },
  quickCardIconWrap: {
    width: 40, height: 40, borderRadius: radius.pill, backgroundColor: colors.primaryBg,
    alignItems: 'center', justifyContent: 'center',
  },
  quickCardText: { ...typography.bodySemibold, color: colors.text },
  quickDotsRow: { flexDirection: 'row', justifyContent: 'center', gap: 6, marginTop: spacing.md },
  quickDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.divider },
  quickDotActive: { backgroundColor: colors.primary, width: 16 },
});
