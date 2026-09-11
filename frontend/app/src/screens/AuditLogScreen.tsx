import React, { useCallback, useState } from 'react';
import { View, Text, FlatList, StyleSheet, ActivityIndicator } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { AppStackParamList } from '../navigation/RootNavigator';
import { useAuth } from '../context/AuthContext';
import { getAuditLog, AuditLogEntry } from '../api/admin';
import { colors, radius, spacing, typography } from '../utils/theme';
import ScreenHeader from '../components/ui/ScreenHeader';
import Card from '../components/ui/Card';

type Props = NativeStackScreenProps<AppStackParamList, 'AuditLog'>;
type IconName = keyof typeof Ionicons.glyphMap;
type EventTone = 'price' | 'order' | 'catalog' | 'security';

const EVENT_LABEL: Record<string, string> = {
  category_price_changed: 'Category price/description changed',
  category_hidden_from_web: 'Category hidden from web',
  category_shown_on_web: 'Category shown on web',
  product_created: 'Product created',
  product_updated: 'Product updated',
  product_image_updated: 'Product photo updated',
  order_marked_shipped: 'Order marked shipped',
  order_marked_delivered: 'Order marked delivered',
  session_revoked_by_admin: 'Session revoked',
  admin_provisioned_user: 'Staff/admin invited',
};

// Icon + tone per event type — price changes read as the brand/primary tone,
// order events as success (green), catalog/category events as a neutral
// muted tone, and security/session events as warning (amber). Anything not
// listed falls back to the neutral catalog tone below.
const EVENT_META: Record<string, { tone: EventTone; icon: IconName }> = {
  category_price_changed: { tone: 'price', icon: 'pricetag-outline' },
  category_hidden_from_web: { tone: 'catalog', icon: 'eye-off-outline' },
  category_shown_on_web: { tone: 'catalog', icon: 'eye-outline' },
  product_created: { tone: 'catalog', icon: 'add-circle-outline' },
  product_updated: { tone: 'catalog', icon: 'create-outline' },
  product_image_updated: { tone: 'catalog', icon: 'image-outline' },
  order_marked_shipped: { tone: 'order', icon: 'cube-outline' },
  order_marked_delivered: { tone: 'order', icon: 'checkmark-circle-outline' },
  session_revoked_by_admin: { tone: 'security', icon: 'shield-outline' },
  admin_provisioned_user: { tone: 'security', icon: 'person-add-outline' },
};

const DEFAULT_EVENT_META: { tone: EventTone; icon: IconName } = { tone: 'catalog', icon: 'document-text-outline' };

const TONE_COLORS: Record<EventTone, { bg: string; fg: string }> = {
  price: { bg: colors.primaryBg, fg: colors.primary },
  order: { bg: colors.successBg, fg: colors.success },
  catalog: { bg: colors.placeholderBg, fg: colors.textMuted },
  security: { bg: colors.warningBg, fg: colors.warning },
};

const actorLabel = (entry: AuditLogEntry) => {
  const acc = entry.authAccount;
  if (!acc) return 'System';
  const profile = acc.adminProfile || acc.userProfile;
  if (profile) return `${profile.firstName} ${profile.lastName}`;
  return acc.phone || acc.email || 'Unknown';
};

export default function AuditLogScreen({ navigation }: Props) {
  const { accessToken } = useAuth();
  const [entries, setEntries] = useState<AuditLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    if (!accessToken) return;
    setLoading(true);
    setError('');
    try {
      const res = await getAuditLog(accessToken);
      setEntries(res.data.items);
    } catch (err: any) {
      setError(err.message || 'Failed to load audit log');
    } finally {
      setLoading(false);
    }
  }, [accessToken]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  return (
    <View style={styles.screen}>
      <View style={styles.container}>
        <ScreenHeader title="Audit Log" subtitle="Every price change and catalog/order action, in order." />

        {loading ? (
          <ActivityIndicator style={{ marginTop: 40 }} color={colors.primary} />
        ) : error ? (
          <Text style={styles.error}>{error}</Text>
        ) : (
          <FlatList
            data={entries}
            keyExtractor={(item) => item.id}
            contentContainerStyle={{ paddingBottom: 40 }}
            showsVerticalScrollIndicator={false}
            ListEmptyComponent={<Text style={styles.empty}>Nothing recorded yet.</Text>}
            renderItem={({ item }) => {
              const meta = EVENT_META[item.eventType] || DEFAULT_EVENT_META;
              const tone = TONE_COLORS[meta.tone];
              return (
                <Card style={styles.row}>
                  <View style={[styles.iconWrap, { backgroundColor: tone.bg }]}>
                    <Ionicons name={meta.icon} size={17} color={tone.fg} />
                  </View>
                  <View style={styles.rowInfo}>
                    <Text style={styles.rowTitle}>{EVENT_LABEL[item.eventType] || item.eventType}</Text>
                    {item.ipAddress ? <Text style={styles.rowDetail}>IP {item.ipAddress}</Text> : null}
                    <Text style={styles.rowMeta}>{actorLabel(item)} · {new Date(item.createdAt).toLocaleString()}</Text>
                  </View>
                </Card>
              );
            }}
          />
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  container: { flex: 1, paddingHorizontal: spacing.md },
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md, marginBottom: spacing.sm + 2, borderRadius: radius.lg },
  iconWrap: { width: 38, height: 38, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center' },
  rowInfo: { flex: 1, minWidth: 0 },
  rowTitle: { ...typography.bodySemibold, color: colors.text },
  rowDetail: { ...typography.bodySm, color: colors.textMuted, marginTop: 3 },
  rowMeta: { ...typography.bodySm, color: colors.textLabel, marginTop: 6 },
  empty: { color: colors.textMuted, fontSize: 13, marginTop: 24, textAlign: 'center' },
  error: {
    color: colors.error, backgroundColor: colors.errorBg, padding: spacing.sm + 2, borderRadius: radius.md, marginTop: spacing.md, fontSize: 13,
  },
});
