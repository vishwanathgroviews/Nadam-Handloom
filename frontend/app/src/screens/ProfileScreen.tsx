import React, { useCallback, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator, ScrollView } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import Constants from 'expo-constants';
import type { AppStackParamList } from '../navigation/RootNavigator';
import { useAuth } from '../context/AuthContext';
import { getMe, StaffProfile } from '../api/user';
import ScreenHeader from '../components/ui/ScreenHeader';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import { Badge } from '../components/ui/Chip';
import { colors, radius, shadow, spacing, typography } from '../utils/theme';

type IconName = keyof typeof Ionicons.glyphMap;

interface ManageItem {
  key: string;
  label: string;
  hint: string;
  icon: IconName;
  onPress: () => void;
}

export default function ProfileScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<AppStackParamList>>();
  const { accessToken, role, logout } = useAuth();
  const tabBarHeight = useBottomTabBarHeight();
  const [profile, setProfile] = useState<StaffProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useFocusEffect(
    useCallback(() => {
      if (!accessToken) return;
      setLoading(true);
      setError('');
      getMe(accessToken)
        .then((res) => setProfile(res.data))
        .catch((err) => setError(err.message || 'Failed to load profile'))
        .finally(() => setLoading(false));
    }, [accessToken])
  );

  const initial = profile?.name?.trim()?.[0]?.toUpperCase() || (role === 'ADMIN' ? 'A' : 'S');

  const manageItems: ManageItem[] = role === 'ADMIN'
    ? [
        { key: 'analytics', label: 'Analytics', hint: 'Online, store & WhatsApp', icon: 'trending-up-outline', onPress: () => navigation.navigate('Analytics') },
        { key: 'sessions', label: 'Sessions', hint: 'Signed-in devices', icon: 'hardware-chip-outline', onPress: () => navigation.navigate('Sessions') },
        { key: 'catalog', label: 'Catalog', hint: 'Categories & pricing', icon: 'albums-outline', onPress: () => navigation.navigate('Categories') },
        // Owner-only: the staff surface no longer carries Inventory at all,
        // but the owner still needs somewhere to receive stock from.
        { key: 'inventory', label: 'Inventory', hint: 'Receive stock', icon: 'cube-outline', onPress: () => navigation.navigate('Inventory') },
        { key: 'staff', label: 'Team', hint: 'Staff & roles', icon: 'people-outline', onPress: () => navigation.navigate('StaffList') },
        { key: 'audit', label: 'Activity', hint: 'Audit log', icon: 'document-text-outline', onPress: () => navigation.navigate('AuditLog') },
      ]
    : [];

  return (
    <View style={styles.screen}>
      <ScrollView
        style={styles.container}
        contentContainerStyle={{ paddingBottom: tabBarHeight + spacing.xl }}
        showsVerticalScrollIndicator={false}
      >
        <ScreenHeader title="Profile" subtitle={role === 'ADMIN' ? 'Owner access' : 'Staff access'} showBack={false} />

        {loading ? (
          <ActivityIndicator style={{ marginTop: 40 }} color={colors.primary} />
        ) : error ? (
          <Text style={styles.error}>{error}</Text>
        ) : (
          <>
            <Card style={styles.identityCard}>
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>{initial}</Text>
              </View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={styles.name}>{profile?.name || 'Staff Member'}</Text>
                <Text style={styles.contact} numberOfLines={1}>{profile?.phone || profile?.email || '—'}</Text>
                <Badge label={role === 'ADMIN' ? 'Owner' : 'Staff'} tone={role === 'ADMIN' ? 'primary' : 'neutral'} />
              </View>
            </Card>

            <Card style={styles.detailsCard}>
              <ProfileRow label="Phone" value={profile?.phone || '—'} />
              <ProfileRow label="Email" value={profile?.email || '—'} />
              {profile?.employeeId ? <ProfileRow label="Employee ID" value={profile.employeeId} /> : null}
              {profile?.department ? <ProfileRow label="Department" value={profile.department} /> : null}
              {profile?.jobTitle ? <ProfileRow label="Job Title" value={profile.jobTitle} last /> : null}
            </Card>

            {manageItems.length > 0 && (
              <>
                <Text style={[typography.caption, styles.sectionLabel]}>Manage</Text>
                <View style={styles.manageGrid}>
                  {manageItems.map((item) => (
                    <TouchableOpacity key={item.key} style={styles.manageCard} onPress={item.onPress} activeOpacity={0.8}>
                      <View style={styles.manageIconWrap}>
                        <Ionicons name={item.icon} size={18} color={colors.primary} />
                      </View>
                      <Text style={styles.manageLabel}>{item.label}</Text>
                      <Text style={styles.manageHint}>{item.hint}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </>
            )}

            <Button title="Log Out" onPress={logout} variant="destructive" style={styles.logoutButton} />

            <Text style={styles.version}>Nandam Handlooms Staff · v{Constants.expoConfig?.version ?? '1.0.0'}</Text>
          </>
        )}
      </ScrollView>
    </View>
  );
}

function ProfileRow({ label, value, last }: { label: string; value: string; last?: boolean }) {
  return (
    <View style={[styles.row, last && styles.rowLast]}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  container: { flex: 1, paddingHorizontal: spacing.md },
  identityCard: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginTop: spacing.sm },
  avatar: {
    width: 60, height: 60, borderRadius: radius.pill, backgroundColor: colors.primary,
    alignItems: 'center', justifyContent: 'center',
  },
  avatarText: { ...typography.h2, color: '#fff' },
  name: { ...typography.bodySemibold, fontSize: 16, color: colors.text },
  contact: { ...typography.bodySm, color: colors.textLabel, marginTop: 2, marginBottom: spacing.sm },
  detailsCard: { marginTop: spacing.md, paddingVertical: 0, paddingHorizontal: spacing.lg },
  row: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingVertical: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.divider,
  },
  rowLast: { borderBottomWidth: 0 },
  rowLabel: { ...typography.bodySm, color: colors.textLabel },
  rowValue: { ...typography.bodySemibold, color: colors.text },
  sectionLabel: { color: colors.textLabel, marginTop: spacing.xl, marginBottom: spacing.md },
  manageGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  manageCard: {
    flexBasis: '47%', flexGrow: 1, backgroundColor: colors.surface, borderRadius: radius.lg,
    padding: spacing.lg, ...shadow.card,
  },
  manageIconWrap: {
    width: 36, height: 36, borderRadius: radius.pill, backgroundColor: colors.primaryBg,
    alignItems: 'center', justifyContent: 'center',
  },
  manageLabel: { ...typography.bodySemibold, color: colors.text, marginTop: spacing.md },
  manageHint: { ...typography.bodySm, color: colors.textLabel, marginTop: 2 },
  logoutButton: { marginTop: spacing.xl },
  version: { textAlign: 'center', color: colors.textMuted, fontSize: 11, marginTop: spacing.lg },
  error: {
    color: colors.error, backgroundColor: colors.errorBg, padding: 10, borderRadius: 8, marginTop: 12, fontSize: 13,
  },
});
