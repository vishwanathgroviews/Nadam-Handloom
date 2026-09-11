import React, { useCallback, useState } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { AppStackParamList } from '../navigation/RootNavigator';
import { useAuth } from '../context/AuthContext';
import { listUsers, AdminUser } from '../api/admin';
import { colors, radius, spacing, typography } from '../utils/theme';
import ScreenHeader from '../components/ui/ScreenHeader';
import Card from '../components/ui/Card';
import { Badge } from '../components/ui/Chip';

type Props = NativeStackScreenProps<AppStackParamList, 'StaffList'>;

const getInitials = (name: string) => {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
};

const formatJoined = (iso: string) =>
  new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });

export default function StaffListScreen({ navigation }: Props) {
  const { accessToken } = useAuth();
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    if (!accessToken) return;
    setLoading(true);
    setError('');
    try {
      const res = await listUsers(accessToken);
      setUsers(res.data);
    } catch (err: any) {
      setError(err.message || 'Failed to load staff');
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
    <View style={styles.container}>
      <ScreenHeader
        title="Team"
        subtitle={`${users.length} ${users.length === 1 ? 'person' : 'people'} with access`}
        rightAction={
          <TouchableOpacity style={styles.inviteChip} onPress={() => navigation.navigate('StaffInvite')} activeOpacity={0.8}>
            <Text style={styles.inviteChipText}>+ Invite</Text>
          </TouchableOpacity>
        }
      />

      {loading ? (
        <ActivityIndicator style={{ marginTop: 40 }} color={colors.primary} />
      ) : error ? (
        <Text style={styles.error}>{error}</Text>
      ) : (
        <FlatList
          data={users}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ paddingBottom: 40 }}
          showsVerticalScrollIndicator={false}
          renderItem={({ item }) => {
            const displayName = item.name || item.email || item.phone || 'Unknown';
            const isAdmin = item.roles.includes('ADMIN');
            return (
              <Card style={styles.card}>
                <View style={styles.avatar}>
                  <Text style={styles.avatarText}>{getInitials(displayName)}</Text>
                </View>
                <View style={styles.info}>
                  <Text style={styles.name}>{displayName}</Text>
                  <Text style={styles.meta}>
                    {item.phone || item.email || '—'} · Added {formatJoined(item.createdAt)}
                  </Text>
                </View>
                <Badge label={isAdmin ? 'Owner' : 'Staff'} tone={isAdmin ? 'primary' : 'neutral'} />
              </Card>
            );
          }}
          ListFooterComponent={
            <TouchableOpacity
              style={styles.inviteCta}
              onPress={() => navigation.navigate('StaffInvite')}
              activeOpacity={0.85}
            >
              <Text style={styles.inviteCtaText}>+ Invite a teammate</Text>
            </TouchableOpacity>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background, padding: spacing.md },
  inviteChip: {
    backgroundColor: colors.primaryBg, borderRadius: radius.pill,
    paddingHorizontal: spacing.md, paddingVertical: spacing.sm,
  },
  inviteChipText: { ...typography.bodySmSemibold, color: colors.primary },
  card: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginBottom: spacing.sm },
  avatar: {
    width: 46, height: 46, borderRadius: radius.pill, backgroundColor: colors.primaryBg,
    alignItems: 'center', justifyContent: 'center',
  },
  avatarText: { ...typography.bodySemibold, color: colors.primary },
  info: { flex: 1, minWidth: 0 },
  name: { ...typography.bodySemibold, color: colors.text },
  meta: { ...typography.bodySm, color: colors.textLabel, marginTop: 3 },
  inviteCta: {
    borderRadius: radius.lg, backgroundColor: colors.segmentTrack,
    padding: spacing.lg, alignItems: 'center', marginTop: spacing.xs,
  },
  inviteCtaText: { ...typography.bodySemibold, color: colors.primary },
  error: {
    color: colors.error, backgroundColor: colors.errorBg, padding: 10, borderRadius: 8, marginTop: 12, fontSize: 13,
  },
});
