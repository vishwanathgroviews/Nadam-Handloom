import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { AuthStackParamList } from '../navigation/RootNavigator';
import { useAuth } from '../context/AuthContext';
import KeyboardAwareScreen from '../components/KeyboardAwareScreen';
import BrandMark from '../components/BrandMark';
import PinCodeInput from '../components/PinCodeInput';
import { colors, radius, spacing, typography, shadow } from '../utils/theme';
import Button from '../components/ui/Button';

type Props = NativeStackScreenProps<AuthStackParamList, 'Otp'>;

const CODE_LENGTH = 6;

export default function OtpScreen({ route, navigation }: Props) {
  const { mobile, devOtp } = route.params;
  const { verifyActivationOtp } = useAuth();
  const [code, setCode] = useState(devOtp ?? '');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    setError('');
    if (code.length !== 6) return setError('Enter the 6-digit code');
    setLoading(true);
    try {
      const setupToken = await verifyActivationOtp({ mobile, code });
      navigation.navigate('MpinSetup', { setupToken });
    } catch (err: any) {
      setError(err.message || 'Verification failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAwareScreen style={styles.screen}>
      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <BrandMark size={56} />
        <Text style={styles.title}>Verify your{'\n'}mobile number.</Text>
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
            <Text style={styles.fieldLabel}>Verification code</Text>
            <PinCodeInput value={code} onChangeText={setCode} length={CODE_LENGTH} autoFocus />
          </View>

          <Button title="Verify" onPress={handleSubmit} loading={loading} style={styles.submitButton} />
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
  submitButton: { marginTop: spacing.xl },
});
