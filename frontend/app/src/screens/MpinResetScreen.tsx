import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { AuthStackParamList } from '../navigation/RootNavigator';
import { useAuth } from '../context/AuthContext';
import KeyboardAwareScreen from '../components/KeyboardAwareScreen';
import BrandMark from '../components/BrandMark';
import PinCodeInput from '../components/PinCodeInput';
import { colors, radius, spacing, typography, shadow } from '../utils/theme';
import Button from '../components/ui/Button';

type Props = NativeStackScreenProps<AuthStackParamList, 'MpinReset'>;

const CODE_LENGTH = 6;
const PIN_LENGTH = 6;

export default function MpinResetScreen({ route, navigation }: Props) {
  const { mobile, devOtp } = route.params;
  const { confirmMpinReset } = useAuth();
  const [code, setCode] = useState(devOtp ?? '');
  const [newMpin, setNewMpin] = useState('');
  const [confirmNewMpin, setConfirmNewMpin] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    setError('');
    if (code.length !== 6) return setError('Enter the 6-digit code');
    if (newMpin.length !== 4 && newMpin.length !== 6) return setError('MPIN must be 4 or 6 digits');
    if (newMpin !== confirmNewMpin) return setError('MPIN and confirmation do not match');

    setLoading(true);
    try {
      await confirmMpinReset({ mobile, code, newMpin, confirmNewMpin });
      setSuccess(true);
    } catch (err: any) {
      setError(err.message || 'Could not reset MPIN');
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <KeyboardAwareScreen style={styles.screen}>
        <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          <BrandMark size={56} />
          <Text style={styles.title}>MPIN{'\n'}reset.</Text>
          <Text style={styles.subtitle}>Your MPIN has been updated. Sign in with your new MPIN.</Text>

          <View style={styles.formCard}>
            <Button title="Back to Sign In" onPress={() => navigation.navigate('MpinLogin')} style={styles.submitButton} />
          </View>
        </ScrollView>
      </KeyboardAwareScreen>
    );
  }

  return (
    <KeyboardAwareScreen style={styles.screen}>
      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <BrandMark size={56} />
        <Text style={styles.title}>Enter reset{'\n'}code.</Text>
        <Text style={styles.subtitle}>We sent a 6-digit code to {mobile}</Text>

        <View style={styles.formCard}>
          {devOtp ? (
            <View style={styles.devBanner}>
              <Ionicons name="information-circle" size={16} color={colors.warning} />
              <Text style={styles.devText}>Dev mode (no SMS gateway configured): code is {devOtp}</Text>
            </View>
          ) : null}

          {error ? (
            <View style={styles.errorBanner}>
              <Ionicons name="alert-circle" size={16} color={colors.error} />
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : null}

          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>Reset code</Text>
            <PinCodeInput value={code} onChangeText={setCode} length={CODE_LENGTH} autoFocus />
          </View>

          <View style={styles.divider} />

          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>New MPIN</Text>
            <PinCodeInput value={newMpin} onChangeText={setNewMpin} length={PIN_LENGTH} />
          </View>

          <View style={styles.divider} />

          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>Confirm new MPIN</Text>
            <PinCodeInput value={confirmNewMpin} onChangeText={setConfirmNewMpin} length={PIN_LENGTH} />
          </View>

          <Button title="Reset MPIN" onPress={handleSubmit} loading={loading} style={styles.submitButton} />
        </View>
      </ScrollView>
    </KeyboardAwareScreen>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  scrollContent: { flexGrow: 1, paddingHorizontal: spacing.xl, paddingTop: 88, paddingBottom: spacing.xxl, justifyContent: 'center' },
  title: { ...typography.display, color: colors.text, marginTop: spacing.lg },
  subtitle: { ...typography.body, color: colors.textMuted, marginTop: spacing.sm },
  formCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.xxl,
    padding: spacing.xl,
    marginTop: spacing.xl,
    ...shadow.raised,
  },
  devBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: colors.warningBg, borderRadius: radius.md,
    padding: spacing.sm + 2, marginBottom: spacing.md,
  },
  devText: { ...typography.bodySm, color: colors.warning, flex: 1 },
  errorBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: colors.errorBg, borderRadius: radius.md,
    padding: spacing.sm + 2, marginBottom: spacing.md,
  },
  errorText: { ...typography.bodySm, color: colors.error, flex: 1 },
  fieldGroup: {},
  fieldLabel: { ...typography.caption, color: colors.textLabel },
  divider: { height: 1, backgroundColor: colors.divider, marginVertical: spacing.lg },
  submitButton: { marginTop: spacing.xl },
});
