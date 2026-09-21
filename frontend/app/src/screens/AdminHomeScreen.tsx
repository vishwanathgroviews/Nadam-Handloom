import React, { useCallback, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, ActivityIndicator } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { AppStackParamList } from '../navigation/RootNavigator';
import { goToTab } from '../navigation/tabs';
import { useAuth } from '../context/AuthContext';
import { getDashboard, DashboardStats, SoldProductLine } from '../api/admin';
import ScreenHeader from '../components/ui/ScreenHeader';
import Card from '../components/ui/Card';
import StatCard from '../components/ui/StatCard';
import BrandMark from '../components/BrandMark';
import QuickActionsCarousel, { QuickAction } from '../components/QuickActionsCarousel';
import { colors, radius, shadow, spacing, typography } from '../utils/theme';

type Props = NativeStackScreenProps<AppStackParamList, 'Home'>;
type IconName = keyof typeof Ionicons.glyphMap;

const formatRupees = (amount: number) => `₹${amount.toLocaleString('en-IN')}`;

interface ManageItem {
  key: string;
  label: string;
  hint: string;
  icon: IconName;
  onPress: () => void;
}

interface SoldRow extends SoldProductLine {
  channel: string;
  dot: string;
}

export default function AdminHomeScreen({ navigation }: Props) {
  const { accessToken } = useAuth();
  const tabBarHeight = useBottomTabBarHeight();
  const [stats, setStats] = useState<DashboardStats | null>(null);

  useFocusEffect(
    useCallback(() => {
      if (!accessToken) return;
      getDashboard(accessToken).then((res) => setStats(res.data)).catch(() => {});
    }, [accessToken])
  );

  const quickActions: QuickAction[] = [
    { key: 'scan', label: 'Scan to sell', icon: 'barcode-outline', onPress: () => goToTab(navigation, 'ScannerTab') },
    { key: 'new', label: 'New product', icon: 'add-circle-outline', onPress: () => navigation.navigate('ProductForm', {}) },
    { key: 'price', label: 'Update prices', icon: 'pricetag-outline', onPress: () => navigation.navigate('Categories') },
    { key: 'analytics', label: 'Analytics', icon: 'trending-up-outline', onPress: () => navigation.navigate('Analytics') },
  ];

  const manageItems: ManageItem[] = [
    { key: 'products', label: 'Products', hint: stats ? `${stats.products.activeCount} live` : '—', icon: 'shirt-outline', onPress: () => goToTab(navigation, 'ProductsTab') },
    { key: 'orders', label: 'Orders', hint: 'Online, store & WhatsApp', icon: 'receipt-outline', onPress: () => navigation.navigate('AllOrders') },
    { key: 'catalog', label: 'Catalog', hint: 'Categories & pricing', icon: 'albums-outline', onPress: () => navigation.navigate('Categories') },
    { key: 'invoices', label: 'Invoices', hint: 'Generated invoices & reports', icon: 'document-text-outline', onPress: () => navigation.navigate('Invoices') },
    { key: 'team', label: 'Team', hint: 'Staff & roles', icon: 'people-outline', onPress: () => navigation.navigate('StaffList') },
    { key: 'activity', label: 'Activity', hint: 'Audit log', icon: 'time-outline', onPress: () => navigation.navigate('AuditLog') },
  ];

  const soldToday: SoldRow[] = stats?.today
    ? [
        ...stats.today.online.products.map((p) => ({ ...p, channel: 'Online order', dot: colors.success })),
        ...stats.today.store.products.map((p) => ({ ...p, channel: 'Store counter', dot: colors.warning })),
        ...stats.today.whatsapp.products.map((p) => ({ ...p, channel: 'WhatsApp order', dot: colors.primary })),
      ]
    : [];

  return (
    <View style={styles.screen}>
      <ScrollView
        style={styles.container}
        contentContainerStyle={{ paddingBottom: tabBarHeight + spacing.sm }}
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

        <View style={styles.hero}>
          <Text style={[typography.micro, styles.heroLabel]}>Sold today</Text>
          {stats?.today ? (
            <Text style={[typography.heroAmount, styles.heroAmount]}>
              {formatRupees(stats.today.online.total + stats.today.store.total + stats.today.whatsapp.total)}
            </Text>
          ) : (
            <ActivityIndicator color="#fff" style={styles.heroSpinner} />
          )}
          {stats?.today && (
            <View style={styles.heroSplitRow}>
              <View style={styles.heroSplitCol}>
                <Text style={styles.heroSplitLabel}>Online</Text>
                <Text style={styles.heroSplitValue} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8}>{stats.today.online.count} · {formatRupees(stats.today.online.total)}</Text>
              </View>
              <View style={styles.heroDivider} />
              <View style={styles.heroSplitCol}>
                <Text style={styles.heroSplitLabel}>Store</Text>
                <Text style={styles.heroSplitValue} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8}>{stats.today.store.count} · {formatRupees(stats.today.store.total)}</Text>
              </View>
              <View style={styles.heroDivider} />
              <View style={styles.heroSplitCol}>
                <Text style={styles.heroSplitLabel}>WhatsApp</Text>
                <Text style={styles.heroSplitValue} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8}>{stats.today.whatsapp.count} · {formatRupees(stats.today.whatsapp.total)}</Text>
              </View>
            </View>
          )}
        </View>

        {/* The same stat tiles as before, two to a row so the row is filled:
            orders waiting to be packed, and orders already on their way. */}
        <View style={styles.statRow}>
          <TouchableOpacity
            style={styles.statTouchable}
            onPress={() => goToTab(navigation, 'OrdersTab', { tab: 'to_ship' })}
            activeOpacity={0.8}
          >
            <StatCard icon="cube-outline" iconColor={colors.warning} iconBg={colors.warningBg} label="To ship" />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.statTouchable}
            onPress={() => goToTab(navigation, 'OrdersTab', { tab: 'shipped' })}
            activeOpacity={0.8}
          >
            <StatCard icon="paper-plane-outline" iconColor={colors.success} iconBg={colors.successBg} label="Shipped" />
          </TouchableOpacity>
        </View>

        <Text style={[typography.caption, styles.sectionLabel]}>Quick actions</Text>
        <QuickActionsCarousel actions={quickActions} />

        {soldToday.length > 0 && (
          <>
            <Text style={[typography.caption, styles.sectionLabel]}>Recent sales</Text>
            <Card style={styles.soldCard}>
              <ScrollView
                style={styles.soldScroll}
                nestedScrollEnabled
                showsVerticalScrollIndicator={soldToday.length > 4}
              >
                {soldToday.map((s, i) => (
                  <View key={`${s.channel}-${s.productId}`} style={[styles.soldRow, i === soldToday.length - 1 && styles.soldRowLast]}>
                    <View style={[styles.soldDot, { backgroundColor: s.dot }]} />
                    <View style={styles.soldInfo}>
                      <Text style={styles.soldName} numberOfLines={2}>{s.productName}</Text>
                      <Text style={styles.soldChannel}>{s.channel}</Text>
                    </View>
                    <Text style={styles.soldAmount}>{formatRupees(s.revenue)}</Text>
                  </View>
                ))}
              </ScrollView>
            </Card>
          </>
        )}

        <Text style={[typography.caption, styles.sectionLabel]}>Manage</Text>
        <View style={styles.manageGrid}>
          {manageItems.map((item, index) => {
            // An odd item count leaves the last tile alone on its own row —
            // stretch that one to the full row width (no dead space on
            // either side) instead of matching its paired siblings' half
            // width, and lay it out horizontally so the wider card doesn't
            // look like a normal tile with its content adrift in a corner.
            const isLastAlone = manageItems.length % 2 !== 0 && index === manageItems.length - 1;
            return (
              <TouchableOpacity
                key={item.key}
                style={[styles.manageCard, isLastAlone && styles.manageCardWide]}
                onPress={item.onPress}
                activeOpacity={0.8}
              >
                <View style={isLastAlone ? styles.manageCardWideRow : undefined}>
                  <View style={[styles.manageIconWrap, isLastAlone && styles.manageIconWrapWide]}>
                    <Ionicons name={item.icon} size={isLastAlone ? 22 : 18} color={colors.primary} />
                  </View>
                  <View>
                    <Text style={[styles.manageLabel, isLastAlone && styles.manageLabelWide]}>{item.label}</Text>
                    <Text style={[styles.manageHint, isLastAlone && styles.manageHintWide]}>{item.hint}</Text>
                  </View>
                </View>
              </TouchableOpacity>
            );
          })}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  statRow: { flexDirection: 'row', gap: spacing.md, marginTop: spacing.lg },
  statTouchable: { flex: 1 },
  screen: { flex: 1, backgroundColor: colors.background },
  container: { flex: 1, paddingHorizontal: spacing.md },
  brandRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  brandWordmark: { color: colors.text, flexShrink: 1, fontFamily: 'Outfit_700Bold' },
  hero: {
    backgroundColor: colors.primary, borderRadius: radius.xxl, padding: spacing.xl,
    ...shadow.brand,
  },
  heroLabel: { color: 'rgba(255,255,255,0.65)' },
  heroAmount: { color: '#fff', marginTop: spacing.sm },
  heroSpinner: { alignSelf: 'flex-start', marginTop: spacing.md },
  heroSplitRow: { flexDirection: 'row', gap: spacing.md, marginTop: spacing.lg },
  heroSplitCol: { flex: 1 },
  heroSplitLabel: { ...typography.bodySm, fontSize: 11.5, color: 'rgba(255,255,255,0.6)' },
  heroSplitValue: { ...typography.bodySemibold, fontSize: 13.5, color: '#fff', marginTop: 3 },
  heroDivider: { width: 1, backgroundColor: 'rgba(255,255,255,0.2)' },
  sectionLabel: { color: colors.textLabel, marginTop: spacing.xl + 2, marginBottom: spacing.md },
  soldCard: { paddingVertical: 0, paddingHorizontal: spacing.lg },
  // Caps the list at roughly 4 rows tall and scrolls internally past that —
  // a busy sales day no longer pushes the rest of the page (Manage grid,
  // etc.) further down; the user scrolls just this card instead.
  soldScroll: { maxHeight: 4 * 64 },
  soldRow: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.md,
    paddingVertical: spacing.md + 2, borderBottomWidth: 1, borderBottomColor: colors.divider,
  },
  soldRowLast: { borderBottomWidth: 0 },
  soldDot: { width: 8, height: 8, borderRadius: 4 },
  soldInfo: { flex: 1, minWidth: 0 },
  soldName: { ...typography.bodyMedium, color: colors.text },
  soldChannel: { ...typography.bodySm, color: colors.textLabel, marginTop: 2 },
  soldAmount: { ...typography.bodySemibold, color: colors.text },
  manageGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  // flexGrow: 0 (not 1) matters here: manageItems currently has an odd count
  // (5), so the last tile lands alone on its own row — with flexGrow:1 it
  // used to stretch to the full row width but leave its (still top-aligned,
  // vertically-stacked) content adrift in the corner of a much wider card —
  // manageCardWide below now handles the lone-last-item case deliberately
  // (full width, horizontal layout) instead of that happening by accident.
  manageCard: {
    flexBasis: '47%', flexGrow: 0, backgroundColor: colors.surface, borderRadius: radius.lg,
    padding: spacing.lg, ...shadow.card,
  },
  // Applied only to a lone last item in an odd-count grid (see isLastAlone
  // above) — full row width, no gap on either side.
  manageCardWide: { flexBasis: '100%' },
  // Centred, not stretched: the icon and its label sit together in the middle
  // of the full-width card. Left-aligning them (or letting the text block grow
  // with flex: 1) pins the wording to the left edge and leaves the rest of the
  // row visibly empty.
  manageCardWideRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.md },
  manageIconWrap: {
    width: 36, height: 36, borderRadius: radius.pill, backgroundColor: colors.primaryBg,
    alignItems: 'center', justifyContent: 'center',
  },
  // Scaled up with the text so the wide card's icon doesn't look undersized
  // next to the larger label.
  manageIconWrapWide: { width: 44, height: 44 },
  manageLabel: { ...typography.bodySemibold, color: colors.text, marginTop: spacing.md },
  // The wide row lays the icon beside the text instead of above it, so the
  // label drops the vertical-stack top margin and reads a size larger — it
  // has the whole row to itself rather than sharing it with a sibling tile.
  manageLabelWide: { marginTop: 0, fontSize: 17, lineHeight: 23 },
  manageHint: { ...typography.bodySm, color: colors.textLabel, marginTop: 2 },
  manageHintWide: { fontSize: 13.5, lineHeight: 19 },
});
