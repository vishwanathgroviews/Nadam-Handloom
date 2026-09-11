import React, { useEffect, useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator, ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { AuthStackParamList } from '../navigation/RootNavigator';
import { useAuth } from '../context/AuthContext';
import KeyboardAwareScreen from '../components/KeyboardAwareScreen';
import BrandMark from '../components/BrandMark';
import PinCodeInput from '../components/PinCodeInput';
import { colors, radius, spacing, typography, shadow } from '../utils/theme';
import Button from '../components/ui/Button';

type Props = NativeStackScreenProps<AuthStackParamList, 'MpinLogin'>;

const PIN_LENGTH = 6;

export default function MpinLoginScreen({ navigation }: Props) {
  const { login, getRememberedMobile } = useAuth();
  const [checkingDevice, setCheckingDevice] = useState(true);
  // Seeds the field on this device; the field itself stays the source of
  // truth once loaded, so staff can correct a wrong number in place.
  const [hadRememberedMobile, setHadRememberedMobile] = useState(false);
  const [mobile, setMobile] = useState('');
  const [mpin, setMpin] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    getRememberedMobile()
      .then((remembered) => {
        if (remembered) {
          setMobile(remembered);
          setHadRememberedMobile(true);
        }
      })
      .finally(() => setCheckingDevice(false));
  }, [getRememberedMobile]);

  const handleSubmit = async () => {
    setError('');
    if (!/^\d{10}$/.test(mobile)) return setError('Enter a valid 10-digit mobile number');
    if (mpin.length < 4) return setError('Enter your MPIN');

    setLoading(true);
    try {
      await login({ mobile, mpin });
    } catch (err: any) {
      setError(err.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  if (checkingDevice) {
    return (
      <View style={styles.loadingScreen}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  return (
    <KeyboardAwareScreen style={styles.screen}>
      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <BrandMark size={56} />
        <Text style={styles.title}>Welcome{'\n'}back.</Text>
        <Text style={styles.subtitle}>Sign in to the Nandam workspace</Text>

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
                onChangeText={(v) => {
                  setMobile(v.replace(/\D/g, ''));
                  setError('');
                }}
                returnKeyType="next"
                autoComplete="tel"
                textContentType="telephoneNumber"
              />
              {mobile.length > 0 && (
                <TouchableOpacity onPress={() => { setMobile(''); setError(''); }} hitSlop={10}>
                  <Ionicons name="close-circle" size={18} color={colors.iconMuted} />
                </TouchableOpacity>
              )}
            </View>
          </View>

          <View style={styles.divider} />

          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>MPIN</Text>
            <PinCodeInput value={mpin} onChangeText={setMpin} length={PIN_LENGTH} autoFocus={hadRememberedMobile} />
          </View>

          <Button title="Sign in" onPress={handleSubmit} loading={loading} style={styles.submitButton} />

          <View style={styles.footerLinks}>
            <TouchableOpacity onPress={() => navigation.navigate('MpinForgot')}>
              <Text style={styles.link}>Forgot MPIN?</Text>
            </TouchableOpacity>
          </View>
        </View>

        <TouchableOpacity style={styles.activateRow} onPress={() => navigation.navigate('Activate')}>
          <Text style={styles.activateText}>
            First time signing in? <Text style={styles.activateTextBold}>Activate your account</Text>
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAwareScreen>
  );
}

const styles = StyleSheet.create({
  loadingScreen: { flex: 1, backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center' },
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
  divider: { height: 1, backgroundColor: colors.divider, marginVertical: spacing.lg },
  submitButton: { marginTop: spacing.xl },
  footerLinks: {
    flexDirection: 'row', justifyContent: 'center', gap: spacing.lg,
    marginTop: spacing.lg,
  },
  link: { color: colors.primary, fontFamily: 'Outfit_600SemiBold', fontSize: 13.5 },
  activateRow: { alignItems: 'center', marginTop: spacing.xl, paddingHorizontal: spacing.xl },
  activateText: { ...typography.bodySm, color: colors.textMuted, textAlign: 'center' },
  activateTextBold: { color: colors.primary, fontFamily: 'Outfit_700Bold' },
});
