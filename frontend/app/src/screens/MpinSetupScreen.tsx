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

type Props = NativeStackScreenProps<AuthStackParamList, 'MpinSetup'>;

const PIN_LENGTH = 6;

export default function MpinSetupScreen({ route }: Props) {
  const { setupToken } = route.params;
  const { setupMpin } = useAuth();
  const [mpin, setMpin] = useState('');
  const [confirmMpin, setConfirmMpin] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    setError('');
    if (mpin.length !== 4 && mpin.length !== 6) return setError('MPIN must be 4 or 6 digits');
    if (mpin !== confirmMpin) return setError('MPIN and confirmation do not match');

    setLoading(true);
    try {
      await setupMpin({ setupToken, mpin, confirmMpin });
      // AuthContext flips to 'authenticated' on success — RootNavigator swaps stacks automatically.
    } catch (err: any) {
      setError(err.message || 'Could not set MPIN');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAwareScreen style={styles.screen}>
      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <BrandMark size={56} />
        <Text style={styles.title}>Set your{'\n'}MPIN.</Text>
        <Text style={styles.subtitle}>Choose a 4 or 6-digit MPIN — you'll use this to log in from now on</Text>

        <View style={styles.formCard}>
          {error ? (
            <View style={styles.errorBanner}>
              <Ionicons name="alert-circle" size={16} color={colors.error} />
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : null}

          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>New MPIN</Text>
            <PinCodeInput value={mpin} onChangeText={setMpin} length={PIN_LENGTH} autoFocus />
          </View>

          <View style={styles.divider} />

          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>Confirm MPIN</Text>
            <PinCodeInput value={confirmMpin} onChangeText={setConfirmMpin} length={PIN_LENGTH} />
          </View>

          <Button title="Set MPIN & Continue" onPress={handleSubmit} loading={loading} style={styles.submitButton} />
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
