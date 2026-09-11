import React, { useCallback, useState } from 'react';
import { View, Text, TextInput, StyleSheet, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { AppStackParamList } from '../navigation/RootNavigator';
import { useAuth } from '../context/AuthContext';
import { provisionUser } from '../api/admin';
import { colors, radius, spacing, typography } from '../utils/theme';
import KeyboardAwareScreen from '../components/KeyboardAwareScreen';
import ScreenHeader from '../components/ui/ScreenHeader';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';

type Props = NativeStackScreenProps<AppStackParamList, 'StaffInvite'>;

// Only an ADMIN can reach this screen (gated in navigation and, more
// importantly, at the API — POST /admin/users requires the ADMIN role
// regardless of how this screen is reached). Every invite provisions a
// STAFF account; granting the Owner/ADMIN role isn't a self-service action
// from this simplified form.
const INVITE_ROLE = 'STAFF' as const;

export default function StaffInviteScreen({ navigation }: Props) {
  const { accessToken } = useAuth();
  const [name, setName] = useState('');
  const [mobile, setMobile] = useState('');
  const [email, setEmail] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleInvite = useCallback(async () => {
    if (!accessToken) return;
    setError('');
    if (name.trim().length < 2) return setError('Enter a name');
    if (!/^\d{10}$/.test(mobile.trim())) return setError('Enter a valid 10-digit mobile number');
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) return setError('Enter a valid email address');

    setSaving(true);
    try {
      await provisionUser(accessToken, { name: name.trim(), mobile: mobile.trim(), email: email.trim().toLowerCase(), role: INVITE_ROLE });
      navigation.goBack();
    } catch (err: any) {
      setError(err.message || 'Failed to invite this person');
    } finally {
      setSaving(false);
    }
  }, [accessToken, name, mobile, email, navigation]);

  return (
    <KeyboardAwareScreen style={styles.container}>
      <ScrollView contentContainerStyle={{ paddingBottom: 60 }} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        <ScreenHeader title="Invite Team Member" subtitle="They'll verify by OTP before they can sign in" />

      {error ? (
        <View style={styles.errorBanner}>
          <Ionicons name="alert-circle" size={16} color={colors.error} />
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : null}

      <Card style={styles.card}>
        <Text style={styles.label}>Full Name</Text>
        <TextInput
          style={styles.input}
          value={name}
          onChangeText={setName}
          placeholder="e.g. Priya Sharma"
          placeholderTextColor={colors.textMuted}
        />

        <View style={styles.divider} />

        <Text style={styles.label}>Mobile Number</Text>
        <TextInput
          style={styles.input}
          value={mobile}
          onChangeText={setMobile}
          keyboardType="phone-pad"
          maxLength={10}
          placeholder="10-digit mobile"
          placeholderTextColor={colors.textMuted}
        />

        <View style={styles.divider} />

        <Text style={styles.label}>Email</Text>
        <TextInput
          style={styles.input}
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          autoCapitalize="none"
          placeholder="name@example.com"
          placeholderTextColor={colors.textMuted}
        />
      </Card>

      <Text style={styles.noteText}>
        We'll text an OTP to this number. They can only sign in after verifying it and setting an MPIN — no one can
        access the app without an invite.
      </Text>

      <Button title="Send Invite" onPress={handleInvite} loading={saving} style={styles.button} />
      </ScrollView>
    </KeyboardAwareScreen>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background, padding: spacing.md },
  card: { marginBottom: spacing.md },
  label: { ...typography.caption, color: colors.textLabel },
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
  divider: { height: 1, backgroundColor: colors.divider, marginVertical: spacing.lg },
  noteText: { ...typography.bodySm, color: colors.textMuted, lineHeight: 18, marginBottom: spacing.lg },
  button: { marginTop: spacing.sm },
  errorBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: colors.errorBg, borderRadius: radius.md,
    padding: spacing.sm + 2, marginBottom: spacing.md,
  },
  errorText: { ...typography.bodySm, color: colors.error, flex: 1 },
});
