import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius, shadow, spacing, typography } from '../../utils/theme';

interface Props {
  title: string;
  subtitle?: string;
  /** Unused visually (the source design has no text next to the back chevron) — kept typed so existing call sites don't need edits. */
  backLabel?: string;
  onBack?: () => void;
  /** Tab-root screens (Home, Orders, Scanner) have no back chevron in the source design. */
  showBack?: boolean;
  rightAction?: React.ReactNode;
  /** Replaces the default title/subtitle text block (e.g. Home's brand lockup) while keeping the same back/bell chrome. `title` is still required for accessibility. */
  titleNode?: React.ReactNode;
}

// Matches the source design's in-content app header: a circular back button,
// a serif title + muted subtitle that truncate to one line, and a circular
// action slot on the right (a notification bell by default).
export default function ScreenHeader({ title, subtitle, onBack, showBack = true, rightAction, titleNode }: Props) {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  // goBack() pops exactly one entry; the canGoBack() guard keeps a stray tap
  // on a root screen from bubbling the action up to a parent navigator,
  // which is what could unwind more than one step at a time.
  const handleBack = onBack ?? (() => { if (navigation.canGoBack()) navigation.goBack(); });
  // Never render a chevron that would do nothing (or, worse, jump somewhere
  // unrelated) — a tab root has nothing beneath it to go back to.
  const canShowBack = showBack && navigation.canGoBack();

  return (
    <View style={[styles.row, { paddingTop: insets.top + spacing.sm }]}>
      {canShowBack && (
        <TouchableOpacity style={styles.iconCircle} onPress={handleBack} activeOpacity={0.75}>
          <Ionicons name="chevron-back" size={18} color={colors.text} />
        </TouchableOpacity>
      )}
      <View style={styles.titleWrap}>
        {titleNode ?? (
          <>
            <Text style={[typography.h1, styles.title]} numberOfLines={1}>{title}</Text>
            {subtitle ? <Text style={[typography.bodySm, styles.subtitle]} numberOfLines={1}>{subtitle}</Text> : null}
          </>
        )}
      </View>
      {/* Notifications are switched off for now (see utils/push.ts) — the
          bell that used to sit here went nowhere, so it is not rendered.
          The slot itself stays only when a screen supplies its own action. */}
      {rightAction ?? null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingBottom: spacing.md },
  titleWrap: { flex: 1, minWidth: 0 },
  title: { color: colors.text },
  subtitle: { color: colors.textLabel, marginTop: 2 },
  iconCircle: {
    width: 38, height: 38, borderRadius: radius.pill, backgroundColor: colors.surface,
    alignItems: 'center', justifyContent: 'center', ...shadow.card,
  },
});
