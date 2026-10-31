// The five main pages and the menu that switches between them (floating bar on
// phones, side rail on tablets). Every other page opens on top of these, from the
// stack in ../_layout.js.
import { Tabs } from 'expo-router';
import { checkIn } from '../../../auth/checkIn';
import { AppTabBar } from '../../../components/AppTabBar';
import { useIsTablet } from '../../../theme/ThemeProvider';
import { orderCount } from '../../../orders/count';

export default function TabsLayout() {
  const tablet = useIsTablet();
  return (
    <Tabs tabBar={(props) => <AppTabBar {...props} />} screenListeners={{ focus: () => { checkIn(); orderCount.refresh(); } }} screenOptions={{ headerShown: false, sceneStyle: tablet ? { paddingLeft: 96 } : undefined }}>
      <Tabs.Screen name="home" options={{ title: 'Home' }} />
      <Tabs.Screen name="orders" options={{ title: 'Orders' }} />
      <Tabs.Screen name="scan" options={{ title: 'Scan' }} />
      <Tabs.Screen name="products" options={{ title: 'Products' }} />
      <Tabs.Screen name="more" options={{ title: 'More' }} />
    </Tabs>
  );
}
