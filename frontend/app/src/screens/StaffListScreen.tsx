import React, { useCallback, useState } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { AppStackParamList } from '../navigation/RootNavigator';
import { useAuth } from '../context/AuthContext';
import { listUsers, revokeUserAccess, AdminUser } from '../api/admin';
import { colors, radius, spacing, typography } from '../utils/theme';
import ScreenHeader from '../components/ui/ScreenHeader';
import { SkeletonList } from '../components/ui/Skeleton';
import Card from '../components/ui/Card';
import { Badge } from '../components/ui/Chip';
import { useDialog } from '../components/DialogProvider';
import { Ionicons } from '@expo/vector-icons';

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
  const { accessToken, user } = useAuth();
  const showDialog = useDialog();
  const [revokingId, setRevokingId] = useState<string | null>(null);
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

  // Two steps on purpose: this signs the person out of every device they are
  // holding and blocks the next sign-in, so it should not happen on a stray
  // tap. It is reversible — Invite puts them back (see provisionUser).
  const handleRevoke = useCallback(
    (member: AdminUser) => {
      const displayName = member.name || member.phone || member.email || 'this person';
      showDialog({
        title: `Revoke ${displayName}'s access?`,
        message:
          'They will be signed out everywhere immediately and will not be able to sign in again.\n\nTheir sales and activity history is kept, and you can invite them back at any time.',
        tone: 'danger',
        dismissOnBackdrop: false,
        actions: [
          {
            label: 'Revoke access',
            variant: 'destructive',
            onPress: async () => {
              if (!accessToken) return;
              setRevokingId(member.id);
              setError('');
              try {
                await revokeUserAccess(accessToken, member.id);
                await load();
              } catch (err: any) {
                setError(err.message || 'Could not revoke access');
              } finally {
                setRevokingId(null);
              }
            },
          },
          { label: 'Cancel' },
        ],
      });
    },
    [accessToken, load, showDialog]
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
        <SkeletonList count={5} variant="text" />
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
                {/* Hidden on your own row: the server refuses it anyway (an
                    owner locking themselves out would leave nobody able to
                    invite anyone back), so offering the button would only be
                    a dead end. */}
                {item.id !== user?.id && (
                  <TouchableOpacity
                    style={styles.revokeButton}
                    onPress={() => handleRevoke(item)}
                    disabled={revokingId === item.id}
                    activeOpacity={0.7}
                    accessibilityRole="button"
                    accessibilityLabel={`Revoke access for ${displayName}`}
                    hitSlop={8}
                  >
                    {revokingId === item.id ? (
                      <ActivityIndicator size="small" color={colors.error} />
                    ) : (
                      <Ionicons name="person-remove-outline" size={18} color={colors.error} />
                    )}
                  </TouchableOpacity>
                )}
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
  revokeButton: {
    width: 36, height: 36, borderRadius: radius.pill, backgroundColor: colors.errorBg,
    alignItems: 'center', justifyContent: 'center',
  },
  inviteCta: {
    borderRadius: radius.lg, backgroundColor: colors.segmentTrack,
    padding: spacing.lg, alignItems: 'center', marginTop: spacing.xs,
  },
  inviteCtaText: { ...typography.bodySemibold, color: colors.primary },
  error: {
    color: colors.error, backgroundColor: colors.errorBg, padding: 10, borderRadius: 8, marginTop: 12, fontSize: 13,
  },
});
