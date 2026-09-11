import React, { useEffect, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { AuthStackParamList } from '../navigation/RootNavigator';
import { useAuth } from '../context/AuthContext';
import KeyboardAwareScreen from '../components/KeyboardAwareScreen';
import BrandMark from '../components/BrandMark';
import { colors, radius, spacing, typography, shadow } from '../utils/theme';
import Button from '../components/ui/Button';

type Props = NativeStackScreenProps<AuthStackParamList, 'MpinForgot'>;

export default function MpinForgotScreen({ navigation }: Props) {
  const { requestMpinReset, getRememberedMobile } = useAuth();
  const [mobile, setMobile] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // Pre-filled as a convenience — this device already knows which account
  // it belongs to (see MpinLoginScreen); still fully editable in case
  // someone's resetting a different account's MPIN from this device.
  useEffect(() => {
    getRememberedMobile().then((remembered) => {
      if (remembered) setMobile(remembered);
    });
  }, [getRememberedMobile]);

  const handleSubmit = async () => {
    setError('');
    if (!/^\d{10}$/.test(mobile)) return setError('Enter a valid 10-digit mobile number');

    setLoading(true);
    try {
      const { devOtp } = await requestMpinReset(mobile);
      navigation.navigate('MpinReset', { mobile, devOtp });
    } catch (err: any) {
      setError(err.message || 'Could not send reset code');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAwareScreen style={styles.screen}>
      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <BrandMark size={56} />
        <Text style={styles.title}>Reset your{'\n'}MPIN.</Text>
        <Text style={styles.subtitle}>Enter your mobile number and we'll send you a reset code</Text>

        <View style={styles.formCard}>
          {error ? (
            <View style={styles.errorBanner}>
              <Ionicons name="alert-circle" size={16} color={colors.error} />
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : null}

          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>Mobile</Text>
            <View style={styles.inputWrap}>
              <Ionicons name="call-outline" size={17} color={colors.textMuted} />
              <TextInput
                style={styles.input}
                keyboardType="number-pad"
                maxLength={10}
                placeholder="9876543210"
                placeholderTextColor={colors.textMuted}
                value={mobile}
                onChangeText={(v) => setMobile(v.replace(/\D/g, ''))}
              />
            </View>
          </View>

          <Button title="Send Reset Code" onPress={handleSubmit} loading={loading} style={styles.submitButton} />

          <View style={styles.footerLinks}>
            <TouchableOpacity onPress={() => navigation.navigate('MpinLogin')}>
              <Text style={styles.link}>Back to Sign In</Text>
            </TouchableOpacity>
          </View>
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
  inputWrap: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    marginTop: spacing.sm,
  },
  input: { flex: 1, paddingVertical: 4, fontSize: 17, color: colors.text, fontFamily: 'Outfit_500Medium' },
  submitButton: { marginTop: spacing.xl },
  footerLinks: {
    flexDirection: 'row', justifyContent: 'center', gap: spacing.lg,
    marginTop: spacing.lg,
  },
  link: { color: colors.primary, fontFamily: 'Outfit_600SemiBold', fontSize: 13.5 },
});
