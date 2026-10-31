// Main menu. Phone: the chosen floating tab bar. Tablet: a side rail with the logo.
// Only the five main pages show it: every other page opens on top of it (app/(app)/_layout.js).
import { Image, Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme, useIsTablet } from '../theme/ThemeProvider';
import { useKeyboardVisible } from '../hooks/useKeyboardVisible';
import { useToShipCount } from '../orders/count';
import { Icon } from './Icon';
import { T } from './T';

const TABS = { home: ['home', 'Home'], orders: ['orders', 'Orders'], scan: ['scan', 'Scan'], products: ['box', 'Products'], more: ['more', 'More'] };
const logo = require('../../assets/logo.png');

function CountBadge({ n }) {
  const { c } = useTheme();
  if (!n) return null;
  return (
    <View style={{ position: 'absolute', top: -4, right: -10, minWidth: 18, height: 18, paddingHorizontal: 5, borderRadius: 9, backgroundColor: c.danger, alignItems: 'center', justifyContent: 'center' }}>
      <T variant="caption" color="onDanger" style={{ fontSize: 11, lineHeight: 14, fontFamily: 'PlusJakartaSans_700Bold' }}>{n > 99 ? '99+' : n}</T>
    </View>
  );
}

export function AppTabBar({ state, navigation }) {
  const { c, radius } = useTheme();
  const tablet = useIsTablet();
  const insets = useSafeAreaInsets();
  const keyboardOpen = useKeyboardVisible();
  const toShip = useToShipCount(); // Module 7: orders waiting to ship, shown on the Orders tab
  const go = (route, focused) => {
    const e = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
    if (!focused && !e.defaultPrevented) navigation.navigate(route.name);
  };

  if (tablet) {
    return (
      <View style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 96, paddingTop: insets.top + 16, alignItems: 'center', gap: 6, backgroundColor: c.surface, borderRightWidth: 1, borderRightColor: c.border }}>
        <Image source={logo} style={{ width: 48, height: 48, borderRadius: 24, marginBottom: 14 }} accessibilityLabel="Nandam Handlooms" />
        {state.routes.map((route, i) => {
          const focused = state.index === i;
          const [icon, label] = TABS[route.name] || ['info', route.name];
          return (
            <Pressable key={route.key} accessibilityRole="tab" accessibilityState={{ selected: focused }} accessibilityLabel={route.name === 'orders' && toShip ? `${label}, ${toShip} to ship` : label} onPress={() => go(route, focused)}
              style={{ width: 76, height: 64, borderRadius: radius.lg, alignItems: 'center', justifyContent: 'center', gap: 4, backgroundColor: focused ? c.primarySoft : 'transparent' }}>
              <View><Icon name={icon} color={focused ? c.primary : c.muted} />{route.name === 'orders' ? <CountBadge n={toShip} /> : null}</View>
              <T variant="caption" color={focused ? 'primary' : 'muted'}>{label}</T>
            </Pressable>
          );
        })}
      </View>
    );
  }

  if (keyboardOpen) return null; // the floating bar would sit on top of the keyboard and the form

  return (
    <View style={{ position: 'absolute', left: 14, right: 14, bottom: Math.max(insets.bottom, 10) + 4, height: 68, borderRadius: radius.pill, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 6,
      backgroundColor: c.surface, borderWidth: 1, borderColor: c.border, shadowColor: c.shadow, shadowOpacity: 0.16, shadowRadius: 20, shadowOffset: { width: 0, height: 8 }, elevation: 10 }}>
      {state.routes.map((route, i) => {
        const focused = state.index === i;
        const [icon, label] = TABS[route.name] || ['info', route.name];
        if (route.name === 'scan') {
          return (
            <Pressable key={route.key} accessibilityRole="tab" accessibilityLabel="Scan" accessibilityState={{ selected: focused }} onPress={() => go(route, focused)} style={{ flex: 1, alignItems: 'center' }}>
              <View style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: c.primary, alignItems: 'center', justifyContent: 'center' }}>
                <Icon name="scan" color={c.onPrimary} />
              </View>
            </Pressable>
          );
        }
        return (
          <Pressable key={route.key} accessibilityRole="tab" accessibilityLabel={route.name === 'orders' && toShip ? `${label}, ${toShip} to ship` : label} accessibilityState={{ selected: focused }} onPress={() => go(route, focused)}
            style={{ flex: 1, height: 56, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center', gap: 2, backgroundColor: focused ? c.primarySoft : 'transparent' }}>
            <View><Icon name={icon} size={23} color={focused ? c.primary : c.muted} />{route.name === 'orders' ? <CountBadge n={toShip} /> : null}</View>
            <T variant="caption" color={focused ? 'primary' : 'muted'} style={{ fontSize: 11 }}>{label}</T>
          </Pressable>
        );
      })}
    </View>
  );
}
