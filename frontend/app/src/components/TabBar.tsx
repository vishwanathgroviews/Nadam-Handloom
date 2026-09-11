import React from 'react';
import { View, TouchableOpacity, Text, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { colors, radius, shadow, spacing } from '../utils/theme';

type IconName = keyof typeof Ionicons.glyphMap;

const TAB_ICONS: Record<string, { active: IconName; inactive: IconName }> = {
  HomeTab: { active: 'home', inactive: 'home-outline' },
  OrdersTab: { active: 'receipt', inactive: 'receipt-outline' },
  ScannerTab: { active: 'scan-circle', inactive: 'scan-circle-outline' },
  ProductsTab: { active: 'albums', inactive: 'albums-outline' },
  ProfileTab: { active: 'ellipsis-horizontal-circle', inactive: 'ellipsis-horizontal-circle-outline' },
};

// Floating pill nav — matches the source design's bottom bar exactly: a
// white, rounded, shadowed strip inset from the screen edges, with the
// active tab reading as a soft maroon-tinted pill.
export default function TabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.wrapper, { paddingBottom: insets.bottom + spacing.md }]} pointerEvents="box-none">
      <View style={styles.pill}>
        {state.routes.map((route, index) => {
          const { options } = descriptors[route.key];
          const focused = state.index === index;
          const icons = TAB_ICONS[route.name] ?? TAB_ICONS.HomeTab!;
          const label = typeof options.title === 'string' ? options.title : route.name;
          const color = focused ? colors.primary : '#6F645D';

          const onPress = () => {
            const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
            if (!focused && !event.defaultPrevented) {
              navigation.navigate(route.name);
            }
          };

          return (
            <TouchableOpacity
              key={route.key}
              accessibilityRole="button"
              accessibilityState={focused ? { selected: true } : {}}
              accessibilityLabel={options.tabBarAccessibilityLabel}
              onPress={onPress}
              style={[styles.tab, focused && styles.tabActive]}
              activeOpacity={0.75}
            >
              <Ionicons name={focused ? icons.active : icons.inactive} size={20} color={color} />
              <Text style={[styles.label, { color }]} numberOfLines={1}>{label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { paddingHorizontal: spacing.lg, paddingTop: spacing.sm, backgroundColor: colors.background },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.surface,
    borderRadius: radius.pill,
    padding: 8,
    ...shadow.floating,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    borderRadius: radius.pill,
    gap: 3,
  },
  tabActive: { backgroundColor: colors.primaryBg },
  label: { fontSize: 9.5, fontWeight: '600' },
});
