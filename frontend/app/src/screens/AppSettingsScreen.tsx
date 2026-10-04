import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, TextInput, Switch, StyleSheet, ScrollView, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import { useAppConfig } from '../context/AppConfigContext';
import { AppConfig, AppConfigInput, PlatformUpdateConfig, updateAppConfig } from '../api/appConfig';
import { AppPlatform, wouldRequireUpdate } from '../utils/appGate';
import { appPlatform, currentBuild } from '../utils/appVersion';
import { useDialog } from '../components/DialogProvider';
import KeyboardAwareScreen from '../components/KeyboardAwareScreen';
import ScreenHeader from '../components/ui/ScreenHeader';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import { colors, radius, spacing, typography } from '../utils/theme';

// Build numbers are typed, so they are held as text until Save checks them.
interface PlatformForm {
  latestBuild: string;
  minBuild: string;
  forceUpdate: boolean;
  updateUrl: string;
}

interface Form {
  maintenance: { enabled: boolean; message: string };
  webMaintenance: { enabled: boolean; message: string };
  android: PlatformForm;
  ios: PlatformForm;
}

const PLATFORM_NAMES: Record<AppPlatform, string> = { android: 'Android', ios: 'iPhone' };

const toPlatformForm = (p: PlatformUpdateConfig): PlatformForm => ({
  latestBuild: String(p.latestBuild),
  minBuild: String(p.minBuild),
  forceUpdate: p.forceUpdate,
  updateUrl: p.updateUrl,
});

const toForm = (config: AppConfig): Form => ({
  maintenance: { ...config.maintenance },
  webMaintenance: { ...config.webMaintenance },
  android: toPlatformForm(config.android),
  ios: toPlatformForm(config.ios),
});

/** The settings as the server wants them, or the first problem found. */
const toInput = (form: Form): { input: AppConfigInput } | { error: string } => {
  const platforms = {} as Record<AppPlatform, PlatformUpdateConfig>;
  for (const platform of ['android', 'ios'] as const) {
    const name = PLATFORM_NAMES[platform];
    const { latestBuild, minBuild, forceUpdate, updateUrl } = form[platform];
    if (!/^\d{1,6}$/.test(latestBuild.trim())) return { error: `${name}: enter the latest version as a whole number, e.g. 23` };
    if (!/^\d{1,6}$/.test(minBuild.trim())) return { error: `${name}: enter the minimum version as a whole number, e.g. 22` };
    const latest = Number(latestBuild);
    const min = Number(minBuild);
    if (min > latest) return { error: `${name}: the minimum version cannot be higher than the latest version` };
    const url = updateUrl.trim();
    if (url && !/^https:\/\/\S+$/.test(url)) return { error: `${name}: the update link must start with https://` };
    platforms[platform] = { latestBuild: latest, minBuild: min, forceUpdate, updateUrl: url };
  }
  return {
    input: {
      maintenance: { enabled: form.maintenance.enabled, message: form.maintenance.message.trim() },
      webMaintenance: { enabled: form.webMaintenance.enabled, message: form.webMaintenance.message.trim() },
      android: platforms.android,
      ios: platforms.ios,
    },
  };
};

// Only an ADMIN can reach this screen (the Profile menu shows it to owners
// alone and, more importantly, the server refuses the save from anyone else).
export default function AppSettingsScreen() {
  const { accessToken, role } = useAuth();
  const { config, refresh, setConfig } = useAppConfig();
  const showDialog = useDialog();
  const thisPlatform = appPlatform();
  const thisBuild = currentBuild();

  const [form, setForm] = useState<Form | null>(config ? toForm(config) : null);
  const [loadError, setLoadError] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  // Always start from what the server has now, not from what this phone read
  // when it was opened — another owner may have changed it since.
  useEffect(() => {
    let cancelled = false;
    refresh().then((fresh) => {
      if (cancelled) return;
      if (fresh) setForm(toForm(fresh));
      else setLoadError('Could not load the settings. Check your connection and open this screen again.');
    });
    return () => {
      cancelled = true;
    };
  }, [refresh]);

  const setPlatform = (platform: AppPlatform, patch: Partial<PlatformForm>) =>
    setForm((f) => (f ? { ...f, [platform]: { ...f[platform], ...patch } } : f));

  const save = useCallback(
    async (input: AppConfigInput) => {
      if (!accessToken) return;
      setSaving(true);
      try {
        const res = await updateAppConfig(accessToken, input);
        setConfig(res.data);
        setForm(toForm(res.data));
        showDialog({ title: 'Settings saved', message: 'Phones pick up the change the next time the app is opened.', tone: 'success' });
      } catch (err: any) {
        setError(err.message || 'Could not save the settings');
      } finally {
        setSaving(false);
      }
    },
    [accessToken, setConfig, showDialog]
  );

  const handleSave = useCallback(() => {
    if (!form) return;
    setError('');
    const result = toInput(form);
    if ('error' in result) return setError(result.error);

    // Saving a required build this phone does not have locks its own owner
    // out the moment the save lands — say so first.
    if (wouldRequireUpdate(result.input, thisPlatform, thisBuild)) {
      showDialog({
        title: 'This phone will need the update too',
        message: `This phone runs version ${thisBuild}. With these settings it will ask for an update before it can be used again.\n\nSave anyway?`,
        tone: 'warning',
        dismissOnBackdrop: false,
        actions: [
          { label: 'Cancel', variant: 'secondary' },
          { label: 'Save anyway', variant: 'destructive', onPress: () => save(result.input) },
        ],
      });
      return;
    }
    save(result.input);
  }, [form, save, showDialog, thisPlatform, thisBuild]);

  return (
    <KeyboardAwareScreen style={styles.container}>
      <ScrollView contentContainerStyle={{ paddingBottom: 60 }} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        <ScreenHeader title="App Settings" backLabel="Profile" subtitle="Maintenance and app updates" />

        {role !== 'ADMIN' ? (
          <Text style={styles.note}>Only an owner can change these settings.</Text>
        ) : !form ? (
          loadError ? (
            <Banner text={loadError} />
          ) : (
            <ActivityIndicator style={{ marginTop: 40 }} color={colors.primary} />
          )
        ) : (
          <>
            {error ? <Banner text={error} /> : null}

            <Card style={styles.card}>
              <ToggleRow
                label="Staff app maintenance"
                hint="Staff see a maintenance screen and cannot use the app. Owners can still sign in and use it."
                value={form.maintenance.enabled}
                onChange={(enabled) => setForm({ ...form, maintenance: { ...form.maintenance, enabled } })}
              />
              <Text style={[styles.label, styles.fieldGap]}>Message shown to staff</Text>
              <TextInput
                style={[styles.input, styles.messageInput]}
                value={form.maintenance.message}
                onChangeText={(message) => setForm({ ...form, maintenance: { ...form.maintenance, message } })}
                placeholder="e.g. Stock count in progress. Back at 6 pm."
                placeholderTextColor={colors.textMuted}
                maxLength={300}
                multiline
              />
            </Card>

            <Card style={styles.card}>
              <ToggleRow
                label="Website maintenance"
                hint="Customers see a maintenance page instead of the shop website."
                value={form.webMaintenance.enabled}
                onChange={(enabled) => setForm({ ...form, webMaintenance: { ...form.webMaintenance, enabled } })}
              />
              <Text style={[styles.label, styles.fieldGap]}>Message shown to customers</Text>
              <TextInput
                style={[styles.input, styles.messageInput]}
                value={form.webMaintenance.message}
                onChangeText={(message) => setForm({ ...form, webMaintenance: { ...form.webMaintenance, message } })}
                placeholder="e.g. We are updating the shop. Please visit again soon."
                placeholderTextColor={colors.textMuted}
                maxLength={300}
                multiline
              />
            </Card>

            {(['android', 'ios'] as const).map((platform) => (
              <Card key={platform} style={styles.card}>
                <Text style={styles.cardTitle}>{PLATFORM_NAMES[platform]} app</Text>
                {platform === thisPlatform && thisBuild ? (
                  <Text style={styles.thisPhone}>This phone runs version {thisBuild}.</Text>
                ) : null}

                <Text style={[styles.label, styles.fieldGap]}>Latest version (build number)</Text>
                <TextInput
                  style={styles.input}
                  value={form[platform].latestBuild}
                  onChangeText={(latestBuild) => setPlatform(platform, { latestBuild })}
                  keyboardType="number-pad"
                  maxLength={6}
                  placeholder="e.g. 23"
                  placeholderTextColor={colors.textMuted}
                />

                <Text style={[styles.label, styles.fieldGap]}>Minimum version (build number)</Text>
                <TextInput
                  style={styles.input}
                  value={form[platform].minBuild}
                  onChangeText={(minBuild) => setPlatform(platform, { minBuild })}
                  keyboardType="number-pad"
                  maxLength={6}
                  placeholder="e.g. 22"
                  placeholderTextColor={colors.textMuted}
                />
                <Text style={styles.hint}>Phones below the minimum version must update before the app can be used.</Text>

                <View style={styles.divider} />

                <ToggleRow
                  label="Force update"
                  hint="On: every phone below the latest version must update. Off: they only see a notice they can skip."
                  value={form[platform].forceUpdate}
                  onChange={(forceUpdate) => setPlatform(platform, { forceUpdate })}
                />

                <Text style={[styles.label, styles.fieldGap]}>Update link</Text>
                <TextInput
                  style={styles.input}
                  value={form[platform].updateUrl}
                  onChangeText={(updateUrl) => setPlatform(platform, { updateUrl })}
                  keyboardType="url"
                  autoCapitalize="none"
                  autoCorrect={false}
                  placeholder="https://"
                  placeholderTextColor={colors.textMuted}
                />
                <Text style={styles.hint}>
                  {platform === 'ios'
                    ? 'Where "Open TestFlight" takes staff.'
                    : 'Where the "Update" button takes staff — the Play Store page.'}
                </Text>
              </Card>
            ))}

            <Text style={styles.note}>
              Phones read these settings each time the app is opened or brought back to the front. An app that cannot
              reach the server opens normally.
            </Text>

            <Button title="Save" onPress={handleSave} loading={saving} style={styles.saveButton} />
          </>
        )}
      </ScrollView>
    </KeyboardAwareScreen>
  );
}

function Banner({ text }: { text: string }) {
  return (
    <View style={styles.errorBanner}>
      <Ionicons name="alert-circle" size={16} color={colors.error} />
      <Text style={styles.errorText}>{text}</Text>
    </View>
  );
}

function ToggleRow({
  label,
  hint,
  value,
  onChange,
}: {
  label: string;
  hint: string;
  value: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <View style={styles.toggleRow}>
      <View style={styles.toggleText}>
        <Text style={styles.cardTitle}>{label}</Text>
        <Text style={styles.hint}>{hint}</Text>
      </View>
      <Switch
        value={value}
        onValueChange={onChange}
        trackColor={{ false: colors.divider, true: colors.primary }}
        thumbColor="#fff"
        ios_backgroundColor={colors.divider}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background, padding: spacing.md },
  card: { marginBottom: spacing.md },
  cardTitle: { ...typography.bodySemibold, color: colors.text },
  thisPhone: { ...typography.bodySm, color: colors.primary, marginTop: spacing.xs },
  label: { ...typography.caption, color: colors.textLabel },
  fieldGap: { marginTop: spacing.lg },
  input: {
    borderWidth: 0,
    borderRadius: radius.md,
    backgroundColor: colors.inputBg,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    marginTop: spacing.sm,
    fontSize: 15,
    color: colors.text,
  },
  messageInput: { minHeight: 72, textAlignVertical: 'top' },
  hint: { ...typography.bodySm, color: colors.textMuted, lineHeight: 18, marginTop: spacing.xs },
  divider: { height: 1, backgroundColor: colors.divider, marginVertical: spacing.lg },
  toggleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  toggleText: { flex: 1 },
  note: { ...typography.bodySm, color: colors.textMuted, lineHeight: 18, marginBottom: spacing.lg },
  saveButton: { marginTop: spacing.sm },
  errorBanner: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    backgroundColor: colors.errorBg, borderRadius: radius.md,
    padding: spacing.sm + 2, marginBottom: spacing.md,
  },
  errorText: { ...typography.bodySm, color: colors.error, flex: 1 },
});
