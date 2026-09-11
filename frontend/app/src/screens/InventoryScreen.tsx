import React, { useCallback, useState } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { AppStackParamList } from '../navigation/RootNavigator';
import { useAuth } from '../context/AuthContext';
import { getLowStock, LowStockResult, LowStockProduct } from '../api/inventory';
import { colors, radius, spacing, typography } from '../utils/theme';
import ScreenHeader from '../components/ui/ScreenHeader';
import Card from '../components/ui/Card';

type Props = NativeStackScreenProps<AppStackParamList, 'Inventory'>;

// Below this available count a row reads as critical (error tones) rather
// than merely low (warning tones) — matches the source design's ring colors.
const SEVERE_AVAILABLE_COUNT = 1;

export default function InventoryScreen({ navigation }: Props) {
  const { accessToken } = useAuth();
  const [lowStock, setLowStock] = useState<LowStockResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    if (!accessToken) return;
    setLoading(true);
    setError('');
    try {
      const res = await getLowStock(accessToken);
      setLowStock(res.data);
    } catch (err: any) {
      setError(err.message || 'Failed to load low-stock data');
    } finally {
      setLoading(false);
    }
  }, [accessToken]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const items = lowStock?.items ?? [];
  const threshold = lowStock?.threshold ?? 3;

  const renderItem = ({ item }: { item: LowStockProduct }) => {
    const severe = item.availableCount <= SEVERE_AVAILABLE_COUNT;
    return (
      <Card style={styles.row}>
        <View style={[styles.ring, { backgroundColor: severe ? colors.errorBg : colors.warningBg }]}>
          <Text style={[typography.h2, styles.ringText, { color: severe ? colors.error : colors.warning }]}>
            {item.availableCount}
          </Text>
        </View>
        <View style={styles.rowInfo}>
          <Text style={styles.rowTitle} numberOfLines={1}>{item.name}</Text>
          <Text style={styles.rowMeta}>{item.sku} · {item.category.name}</Text>
        </View>
        <TouchableOpacity
          style={styles.receiveButton}
          onPress={() => navigation.navigate('ReceiveStock', { productId: item.id, productName: item.name })}
          activeOpacity={0.8}
        >
          <Text style={styles.receiveButtonText}>Receive</Text>
        </TouchableOpacity>
      </Card>
    );
  };

  return (
    <View style={styles.screen}>
      <View style={styles.container}>
        <ScreenHeader title="Inventory" subtitle="What needs restocking" />

        {loading ? (
          <ActivityIndicator style={{ marginTop: 40 }} color={colors.primary} />
        ) : error ? (
          <Text style={styles.error}>{error}</Text>
        ) : (
          <FlatList
            data={items}
            keyExtractor={(item) => item.id}
            contentContainerStyle={{ paddingBottom: 40 }}
            showsVerticalScrollIndicator={false}
            ListHeaderComponent={
              items.length > 0 ? (
                <Card style={styles.banner}>
                  <Ionicons name="alert-circle" size={22} color={colors.warning} />
                  <Text style={styles.bannerText}>
                    {items.length} active product{items.length === 1 ? '' : 's'} {items.length === 1 ? 'is' : 'are'} at
                    or below {threshold} unit{threshold === 1 ? '' : 's'}.
                  </Text>
                </Card>
              ) : null
            }
            ListEmptyComponent={<Text style={styles.empty}>Nothing is running low right now.</Text>}
            renderItem={renderItem}
          />
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  container: { flex: 1, paddingHorizontal: spacing.md },
  banner: {
    backgroundColor: colors.warningBg,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginBottom: spacing.md,
  },
  bannerText: { ...typography.bodySm, color: colors.warning, flex: 1, lineHeight: 19 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginBottom: spacing.md,
  },
  ring: {
    width: 46,
    height: 46,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    flex: 0,
  },
  ringText: { lineHeight: 24 },
  rowInfo: { flex: 1, minWidth: 0 },
  rowTitle: { ...typography.bodySemibold, color: colors.text },
  rowMeta: { ...typography.bodySm, color: colors.textLabel, marginTop: 3 },
  receiveButton: {
    backgroundColor: colors.inputBg,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 1,
  },
  receiveButtonText: { ...typography.bodySmSemibold, color: colors.text },
  empty: { color: colors.textMuted, fontSize: 13, marginTop: 24, textAlign: 'center' },
  error: {
    color: colors.error, backgroundColor: colors.errorBg, padding: spacing.sm + 2, borderRadius: radius.md, marginTop: spacing.md, fontSize: 13,
  },
});
