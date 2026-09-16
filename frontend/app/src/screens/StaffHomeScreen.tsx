import React, { useCallback, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { AppStackParamList } from '../navigation/RootNavigator';
import { goToTab } from '../navigation/tabs';
import { useAuth } from '../context/AuthContext';
import { getDashboard, DashboardStats, listAdminOrders } from '../api/admin';
import ScreenHeader from '../components/ui/ScreenHeader';
import StatCard from '../components/ui/StatCard';
import BrandMark from '../components/BrandMark';
import QuickActionsCarousel, { QuickAction } from '../components/QuickActionsCarousel';
import { colors, radius, shadow, spacing, typography } from '../utils/theme';

type Props = NativeStackScreenProps<AppStackParamList, 'Home'>;

export default function StaffHomeScreen({ navigation }: Props) {
  const { accessToken } = useAuth();
  const tabBarHeight = useBottomTabBarHeight();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [toShipCount, setToShipCount] = useState<number | null>(null);

  useFocusEffect(
    useCallback(() => {
      if (!accessToken) return;
      getDashboard(accessToken).then((res) => setStats(res.data)).catch(() => {});
      listAdminOrders(accessToken, { status: ['processing'], page: 1 }).then((res) => setToShipCount(res.data.total)).catch(() => {});
    }, [accessToken])
  );

  const quickActions: QuickAction[] = [
    { key: 'scan', label: 'Scan to sell', icon: 'barcode-outline', onPress: () => goToTab(navigation, 'ScannerTab') },
    { key: 'orders', label: 'Orders to ship', icon: 'cube-outline', onPress: () => goToTab(navigation, 'OrdersTab') },
    { key: 'products', label: 'Browse products', icon: 'shirt-outline', onPress: () => goToTab(navigation, 'ProductsTab') },
  ];

  return (
    <View style={styles.screen}>
      <ScrollView
        style={styles.container}
        contentContainerStyle={{ paddingBottom: tabBarHeight + spacing.xl }}
        showsVerticalScrollIndicator={false}
      >
        <ScreenHeader
          title="Nandam Handlooms"
          showBack={false}
          titleNode={
            <View style={styles.brandRow}>
              <BrandMark size={30} />
              <Text style={[typography.h2, styles.brandWordmark]} numberOfLines={1}>Nandam Handlooms</Text>
            </View>
          }
        />

        <View style={styles.welcomeCard}>
          <View style={styles.welcomeIconWrap}>
            <Ionicons name="storefront-outline" size={22} color="#fff" />
          </View>
          <Text style={styles.welcomeTitle}>Ready for the counter</Text>
          <Text style={styles.welcomeSub}>Scan to sell, check stock, or ship what's waiting.</Text>
        </View>

        <View style={styles.statRow}>
          <TouchableOpacity style={styles.statTouchable} onPress={() => navigation.navigate('Inventory')} activeOpacity={0.8}>
            <StatCard icon="alert-circle-outline" iconColor={colors.warning} iconBg={colors.warningBg} label="running low" value={stats?.lowStockCount ?? '—'} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.statTouchable} onPress={() => goToTab(navigation, 'OrdersTab')} activeOpacity={0.8}>
            <StatCard icon="cube-outline" iconColor={colors.success} iconBg={colors.successBg} label="to ship" value={toShipCount ?? '—'} />
          </TouchableOpacity>
        </View>

        <Text style={[typography.caption, styles.sectionLabel]}>Quick actions</Text>
        <QuickActionsCarousel actions={quickActions} />

        <Text style={[typography.caption, styles.sectionLabel]}>Manage</Text>
        <View style={styles.manageGrid}>
          <TouchableOpacity style={styles.manageCard} onPress={() => goToTab(navigation, 'ProductsTab')} activeOpacity={0.8}>
            <View style={styles.manageIconWrap}><Ionicons name="shirt-outline" size={18} color={colors.primary} /></View>
            <Text style={styles.manageLabel}>Products</Text>
            <Text style={styles.manageHint}>{stats ? `${stats.products.activeCount} live` : '—'}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.manageCard} onPress={() => navigation.navigate('Inventory')} activeOpacity={0.8}>
            <View style={styles.manageIconWrap}><Ionicons name="cube-outline" size={18} color={colors.primary} /></View>
            <Text style={styles.manageLabel}>Inventory</Text>
            <Text style={styles.manageHint}>What needs restocking</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.manageCard} onPress={() => navigation.navigate('Invoices')} activeOpacity={0.8}>
            <View style={styles.manageIconWrap}><Ionicons name="document-text-outline" size={18} color={colors.primary} /></View>
            <Text style={styles.manageLabel}>Invoices</Text>
            <Text style={styles.manageHint}>Generated invoices</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  container: { flex: 1, paddingHorizontal: spacing.md },
  brandRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  brandWordmark: { color: colors.text, flexShrink: 1, fontFamily: 'Outfit_700Bold' },
  welcomeCard: {
    backgroundColor: colors.primary, borderRadius: radius.xxl, padding: spacing.xl, ...shadow.brand,
  },
  welcomeIconWrap: {
    width: 44, height: 44, borderRadius: radius.pill, backgroundColor: 'rgba(255,255,255,0.16)',
    alignItems: 'center', justifyContent: 'center', marginBottom: spacing.md,
  },
  welcomeTitle: { ...typography.h2, color: '#fff' },
  welcomeSub: { ...typography.bodySm, color: 'rgba(255,255,255,0.75)', marginTop: 4 },
  statRow: { flexDirection: 'row', gap: spacing.md, marginTop: spacing.lg },
  statTouchable: { flex: 1 },
  sectionLabel: { color: colors.textLabel, marginTop: spacing.xl + 2, marginBottom: spacing.md },
  manageGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  // flexGrow: 0, matching AdminHomeScreen's identical grid — an odd-count
  // last row shouldn't stretch a lone tile to the full row width.
  manageCard: {
    flexBasis: '47%', flexGrow: 0, backgroundColor: colors.surface, borderRadius: radius.lg,
    padding: spacing.lg, ...shadow.card,
  },
  manageIconWrap: {
    width: 36, height: 36, borderRadius: radius.pill, backgroundColor: colors.primaryBg,
    alignItems: 'center', justifyContent: 'center',
  },
  manageLabel: { ...typography.bodySemibold, color: colors.text, marginTop: spacing.md },
  manageHint: { ...typography.bodySm, color: colors.textLabel, marginTop: 2 },
});
