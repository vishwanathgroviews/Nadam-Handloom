import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../context/AuthContext';
import { useAppConfig } from '../context/AppConfigContext';
import { decideAppGate } from '../utils/appGate';
import { appPlatform, currentBuild, openUpdateLink, versionLabel } from '../utils/appVersion';
import BrandMark from './BrandMark';
import Button from './ui/Button';
import { colors, radius, shadow, spacing, typography } from '../utils/theme';

const DEFAULT_MAINTENANCE_MESSAGE = 'The app is not available right now. Please try again in a little while.';

/**
 * Stands between the app and its screens: shows the maintenance screen or
 * the update prompt when the server's app config calls for one, and the app
 * itself otherwise. The rules live in utils/appGate.ts.
 */
export default function AppGate({ children }: { children: React.ReactNode }) {
  const { config, refresh } = useAppConfig();
  const { role, logout } = useAuth();
  const [noticeDismissed, setNoticeDismissed] = useState(false);

  const gate = decideAppGate({ config, platform: appPlatform(), build: currentBuild(), role });

  if (gate.kind === 'update_required') {
    return <UpdateRequiredScreen updateUrl={gate.updateUrl} onCheckAgain={refresh} />;
  }
  if (gate.kind === 'maintenance') {
    return <MaintenanceScreen message={gate.message} onCheckAgain={refresh} onLogout={logout} />;
  }

  return (
    <View style={styles.fill}>
      {children}
      {gate.kind === 'update_available' && !noticeDismissed ? (
        <UpdateNotice updateUrl={gate.updateUrl} onDismiss={() => setNoticeDismissed(true)} />
      ) : null}
    </View>
  );
}

// The iPhone app comes through TestFlight, not a store listing, so the
// wording there points staff at the owner and at TestFlight.
const isIphone = Platform.OS === 'ios';

function useOpenUpdate(updateUrl: string) {
  const [error, setError] = useState('');
  const open = async () => {
    setError('');
    try {
      await openUpdateLink(updateUrl);
    } catch {
      setError('Could not open the update page. Please get the new app from the owner.');
    }
  };
  return { open, error };
}

function UpdateRequiredScreen({ updateUrl, onCheckAgain }: { updateUrl: string; onCheckAgain: () => Promise<unknown> }) {
  const { open, error } = useOpenUpdate(updateUrl);
  const [checking, setChecking] = useState(false);

  const checkAgain = async () => {
    setChecking(true);
    await onCheckAgain();
    setChecking(false);
  };

  return (
    <BlockingScreen
      icon="cloud-download-outline"
      title={'Update\nrequired.'}
      message={
        isIphone
          ? 'This version of the app can no longer be used. Get the new app from the owner, or update it in TestFlight.'
          : 'This version of the app can no longer be used. Install the latest version to continue.'
      }
      error={error}
    >
      <Button title={isIphone ? 'Open TestFlight' : 'Update'} onPress={open} />
      <Button title="Check again" onPress={checkAgain} loading={checking} variant="secondary" style={styles.secondButton} />
    </BlockingScreen>
  );
}

function MaintenanceScreen({
  message,
  onCheckAgain,
  onLogout,
}: {
  message: string;
  onCheckAgain: () => Promise<unknown>;
  onLogout: () => Promise<void>;
}) {
  const [checking, setChecking] = useState(false);

  const checkAgain = async () => {
    setChecking(true);
    await onCheckAgain();
    setChecking(false);
  };

  return (
    <BlockingScreen icon="construct-outline" title={'Under\nmaintenance.'} message={message.trim() || DEFAULT_MAINTENANCE_MESSAGE}>
      <Button title="Try again" onPress={checkAgain} loading={checking} />
      {/* The way out for an owner who is signed in on a staff account. */}
      <Button title="Log Out" onPress={onLogout} variant="secondary" style={styles.secondButton} />
    </BlockingScreen>
  );
}

function BlockingScreen({
  icon,
  title,
  message,
  error,
  children,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  message: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.screenContent} showsVerticalScrollIndicator={false}>
      <BrandMark size={56} />
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.message}>{message}</Text>

      <View style={styles.card}>
        <View style={styles.iconWrap}>
          <Ionicons name={icon} size={22} color={colors.primary} />
        </View>
        {error ? <Text style={styles.error}>{error}</Text> : null}
        {children}
      </View>

      <Text style={styles.version}>Nandam Handlooms Staff · {versionLabel()}</Text>
    </ScrollView>
  );
}

function UpdateNotice({ updateUrl, onDismiss }: { updateUrl: string; onDismiss: () => void }) {
  const insets = useSafeAreaInsets();
  const { open, error } = useOpenUpdate(updateUrl);

  return (
    <View style={[styles.notice, { top: insets.top + spacing.sm }]}>
      <Ionicons name="cloud-download-outline" size={20} color={colors.primary} />
      <View style={styles.noticeBody}>
        <Text style={styles.noticeTitle}>A new version of the app is available.</Text>
        {error ? <Text style={styles.noticeError}>{error}</Text> : null}
        <View style={styles.noticeActions}>
          <TouchableOpacity onPress={onDismiss} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Text style={styles.noticeLater}>Later</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={open} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Text style={styles.noticeUpdate}>{isIphone ? 'Open TestFlight' : 'Update'}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  screen: { flex: 1, backgroundColor: colors.background },
  screenContent: { flexGrow: 1, paddingHorizontal: spacing.xl, paddingTop: 88, paddingBottom: spacing.xxl, justifyContent: 'center' },
  title: { ...typography.display, color: colors.text, marginTop: spacing.lg },
  message: { ...typography.body, color: colors.textMuted, marginTop: spacing.sm },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.xxl,
    padding: spacing.xl,
    marginTop: spacing.xl,
    ...shadow.raised,
  },
  iconWrap: {
    width: 44, height: 44, borderRadius: radius.pill, backgroundColor: colors.primaryBg,
    alignItems: 'center', justifyContent: 'center', marginBottom: spacing.lg,
  },
  error: {
    ...typography.bodySm, color: colors.error, backgroundColor: colors.errorBg,
    borderRadius: radius.md, padding: spacing.sm + 2, marginBottom: spacing.md,
  },
  secondButton: { marginTop: spacing.sm + 2 },
  version: { textAlign: 'center', color: colors.textMuted, fontSize: 11, marginTop: spacing.xl },
  notice: {
    position: 'absolute', left: spacing.md, right: spacing.md,
    flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md,
    backgroundColor: colors.surface, borderRadius: radius.lg, padding: spacing.lg,
    ...shadow.floating,
  },
  noticeBody: { flex: 1 },
  noticeTitle: { ...typography.bodySemibold, color: colors.text },
  noticeError: { ...typography.bodySm, color: colors.error, marginTop: spacing.xs },
  noticeActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: spacing.xl, marginTop: spacing.md },
  noticeLater: { ...typography.bodySemibold, color: colors.textMuted },
  noticeUpdate: { ...typography.bodySemibold, color: colors.primary },
});
