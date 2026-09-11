import React, { useCallback, useState } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, ActivityIndicator, Alert } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { AppStackParamList } from '../navigation/RootNavigator';
import { useAuth } from '../context/AuthContext';
import { listSessions, revokeSession, AdminSession } from '../api/admin';
import { colors, radius, spacing, typography } from '../utils/theme';
import ScreenHeader from '../components/ui/ScreenHeader';
import Card from '../components/ui/Card';

type Props = NativeStackScreenProps<AppStackParamList, 'Sessions'>;

const nameFor = (session: AdminSession) => {
  const profile = session.authAccount.adminProfile;
  if (profile) return `${profile.firstName} ${profile.lastName}`;
  return session.authAccount.phone || session.authAccount.email || 'Unknown';
};

export default function SessionsScreen({ navigation }: Props) {
  const { accessToken } = useAuth();
  const [sessions, setSessions] = useState<AdminSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [revokingId, setRevokingId] = useState<string | null>(null);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    if (!accessToken) return;
    setLoading(true);
    setError('');
    try {
      const res = await listSessions(accessToken);
      setSessions(res.data);
    } catch (err: any) {
      setError(err.message || 'Failed to load sessions');
    } finally {
      setLoading(false);
    }
  }, [accessToken]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const handleRevoke = (session: AdminSession) => {
    Alert.alert('Revoke session?', `Sign out ${nameFor(session)}'s ${session.platform || 'device'} immediately?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Revoke',
        style: 'destructive',
        onPress: async () => {
          if (!accessToken) return;
          setRevokingId(session.id);
          try {
            await revokeSession(accessToken, session.id);
            setSessions((prev) => prev.filter((s) => s.id !== session.id));
          } catch (err: any) {
            setError(err.message || 'Failed to revoke session');
          } finally {
            setRevokingId(null);
          }
        },
      },
    ]);
  };

  return (
    <View style={styles.container}>
      <ScreenHeader title="Sessions & Devices" subtitle="Lost a phone? Revoke its session here to lock it out immediately." />
      {error ? <Text style={styles.error}>{error}</Text> : null}

      {loading ? (
        <ActivityIndicator style={{ marginTop: 40 }} color={colors.primary} />
      ) : (
        <FlatList
          data={sessions}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ paddingBottom: 40 }}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={<Text style={styles.empty}>No active sessions.</Text>}
          renderItem={({ item }) => {
            const revoking = revokingId === item.id;
            return (
              <Card style={styles.card}>
                <View style={styles.iconWrap}>
                  <Ionicons name="hardware-chip-outline" size={18} color={colors.primary} />
                </View>
                <View style={styles.info}>
                  <Text style={styles.cardTitle}>{nameFor(item)}</Text>
                  <Text style={styles.cardMeta}>
                    {item.authAccount.roles.map((r) => r.role.name).join(', ')} · {item.platform || 'unknown platform'}
                  </Text>
                  <Text style={styles.cardMeta}>Since {new Date(item.createdAt).toLocaleDateString()}</Text>
                </View>
                <TouchableOpacity
                  style={styles.revokeChip}
                  onPress={() => handleRevoke(item)}
                  disabled={revoking}
                  activeOpacity={0.8}
                >
                  {revoking ? (
                    <ActivityIndicator size="small" color={colors.error} />
                  ) : (
                    <Text style={styles.revokeChipText}>Revoke</Text>
                  )}
                </TouchableOpacity>
              </Card>
            );
          }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background, padding: spacing.md },
  card: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginBottom: spacing.sm },
  iconWrap: {
    width: 44, height: 44, borderRadius: radius.pill, backgroundColor: colors.primaryBg,
    alignItems: 'center', justifyContent: 'center',
  },
  info: { flex: 1, minWidth: 0 },
  cardTitle: { ...typography.bodySemibold, color: colors.text },
  cardMeta: { ...typography.bodySm, color: colors.textLabel, marginTop: 2 },
  revokeChip: {
    backgroundColor: colors.errorBg, borderRadius: radius.pill,
    paddingHorizontal: spacing.md, paddingVertical: spacing.sm, minWidth: 68, alignItems: 'center',
  },
  revokeChipText: { ...typography.bodySmSemibold, color: colors.error },
  empty: { color: colors.textMuted, fontSize: 13, marginTop: 24, textAlign: 'center' },
  error: {
    color: colors.error, backgroundColor: colors.errorBg, padding: 10, borderRadius: 8, marginBottom: 12, fontSize: 13,
  },
});
