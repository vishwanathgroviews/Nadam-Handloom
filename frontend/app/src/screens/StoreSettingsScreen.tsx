import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { AppStackParamList } from '../navigation/RootNavigator';
import { useAuth } from '../context/AuthContext';
import { getStoreSettings, updateStoreSettings, StoreSettings } from '../api/admin';
import { colors, radius, spacing, typography } from '../utils/theme';
import KeyboardAwareScreen from '../components/KeyboardAwareScreen';
import ScreenHeader from '../components/ui/ScreenHeader';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';

type Props = NativeStackScreenProps<AppStackParamList, 'StoreSettings'>;

// Converts a stored phone number (e.g. "+91 63011 51166" or "+916301151166")
// to an editable 10-digit format without the +91 country prefix
const toEditableNumber = (phoneStr?: string): string => {
  if (!phoneStr) return '';
  const trimmed = phoneStr.trim();
  if (trimmed.startsWith('+91')) {
    return trimmed.slice(3).trim();
  }
  const digits = trimmed.replace(/\D/g, '');
  if (digits.length === 12 && digits.startsWith('91')) {
    return `${digits.slice(2, 7)} ${digits.slice(7)}`;
  }
  if (digits.length === 11 && digits.startsWith('0')) {
    return `${digits.slice(1, 6)} ${digits.slice(6)}`;
  }
  if (digits.length === 10) {
    return `${digits.slice(0, 5)} ${digits.slice(5)}`;
  }
  return trimmed;
};

export default function StoreSettingsScreen({ navigation }: Props) {
  const { accessToken } = useAuth();
  const [currentSettings, setCurrentSettings] = useState<StoreSettings | null>(null);
  const [phoneInput, setPhoneInput] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Fetch current store phone on load
  const loadSettings = useCallback(async () => {
    if (!accessToken) return;
    setLoading(true);
    setError('');
    try {
      const res = await getStoreSettings(accessToken);
      setCurrentSettings(res.data);
      setPhoneInput(toEditableNumber(res.data.displayPhone || res.data.phone));
    } catch (err: any) {
      setError(err.message || 'Failed to load store settings');
    } finally {
      setLoading(false);
    }
  }, [accessToken]);

  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  const handlePhoneChange = useCallback((val: string) => {
    setSuccess('');
    setError('');
    let clean = val;
    // If admin pastes or types a number with +91 or + or 91 prefix, strip it so it doesn't duplicate
    if (clean.startsWith('+91')) {
      clean = clean.slice(3).trim();
    } else if (clean.startsWith('+')) {
      clean = clean.slice(1).trim();
    }
    const rawDigits = clean.replace(/\D/g, '');
    if (rawDigits.length > 10 && rawDigits.startsWith('91')) {
      clean = rawDigits.slice(2);
    }
    setPhoneInput(clean);
  }, []);

  const handleSave = useCallback(async () => {
    if (!accessToken) return;
    setError('');
    setSuccess('');

    const cleaned = phoneInput.trim();
    const digits = cleaned.replace(/\D/g, '');
    let tenDigits = digits;
    if (digits.length === 12 && digits.startsWith('91')) {
      tenDigits = digits.slice(2);
    } else if (digits.length === 11 && digits.startsWith('0')) {
      tenDigits = digits.slice(1);
    }

    if (tenDigits.length !== 10 || !/^[6-9]/.test(tenDigits)) {
      return setError('Please enter a valid 10-digit Indian phone number (e.g. 63011 51166)');
    }

    setSaving(true);
    try {
      // Backend expects the phone number — since +91 is provided by default in the UI,
      // we send it normalized with +91:
      const fullNumber = `+91${tenDigits}`;
      const res = await updateStoreSettings(accessToken, fullNumber);
      setCurrentSettings(res.data);
      setPhoneInput(toEditableNumber(res.data.displayPhone || res.data.phone));
      setSuccess('Store phone number updated successfully!');
    } catch (err: any) {
      setError(err.message || 'Failed to update store phone number');
    } finally {
      setSaving(false);
    }
  }, [accessToken, phoneInput]);

  return (
    <KeyboardAwareScreen style={styles.container}>
      <ScrollView
        contentContainerStyle={{ paddingBottom: 60 }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <ScreenHeader
          title="Store Settings"
          subtitle="Configure the store's contact number"
        />

        {error ? (
          <View style={styles.errorBanner}>
            <Ionicons name="alert-circle" size={16} color={colors.error} />
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}

        {success ? (
          <View style={styles.successBanner}>
            <Ionicons name="checkmark-circle" size={16} color={colors.success} />
            <Text style={styles.successText}>{success}</Text>
          </View>
        ) : null}

        {loading ? (
          <View style={styles.loaderWrap}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={styles.loaderText}>Loading store settings...</Text>
          </View>
        ) : (
          <>
            {/* Current Active Number Summary */}
            <Card style={styles.summaryCard}>
              <View style={styles.summaryRow}>
                <View style={styles.iconCircle}>
                  <Ionicons name="call" size={20} color={colors.primary} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.summaryLabel}>Active Store Number</Text>
                  <Text style={styles.summaryValue}>
                    {currentSettings?.displayPhone || '—'}
                  </Text>
                </View>
              </View>
            </Card>

            {/* Edit Phone Number Form */}
            <Card style={styles.card}>
              <Text style={styles.label}>Store Contact Phone Number</Text>
              <View style={styles.phoneInputRow}>
                <View style={styles.countryCodeBadge}>
                  <Text style={styles.countryCodeText}>+91</Text>
                </View>
                <View style={styles.divider} />
                <TextInput
                  style={styles.input}
                  value={phoneInput}
                  onChangeText={handlePhoneChange}
                  keyboardType="phone-pad"
                  placeholder="63011 51166"
                  placeholderTextColor={colors.textMuted}
                />
                {phoneInput.length > 0 && (
                  <TouchableOpacity
                    onPress={() => {
                      setPhoneInput('');
                      setSuccess('');
                      setError('');
                    }}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                    style={styles.clearBtn}
                  >
                    <Ionicons name="close-circle" size={18} color={colors.iconMuted} />
                  </TouchableOpacity>
                )}
              </View>
            </Card>

            <Button
              title={saving ? 'Saving...' : 'Save Phone Number'}
              onPress={handleSave}
              disabled={saving}
              style={styles.saveButton}
            />
          </>
        )}
      </ScrollView>
    </KeyboardAwareScreen>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  loaderWrap: {
    padding: spacing.xl,
    alignItems: 'center',
    gap: spacing.sm,
  },
  loaderText: {
    ...typography.bodySmall,
    color: colors.textMuted,
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: '#FDE8E8',
    borderColor: '#F8B4B4',
    borderWidth: 1,
    padding: spacing.sm,
    borderRadius: radius.md,
    marginHorizontal: spacing.md,
    marginBottom: spacing.md,
  },
  errorText: {
    ...typography.caption,
    color: colors.error,
    flex: 1,
  },
  successBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: '#DEF7EC',
    borderColor: '#BCF0DA',
    borderWidth: 1,
    padding: spacing.sm,
    borderRadius: radius.md,
    marginHorizontal: spacing.md,
    marginBottom: spacing.md,
  },
  successText: {
    ...typography.caption,
    color: colors.success,
    flex: 1,
  },
  summaryCard: {
    marginHorizontal: spacing.md,
    marginBottom: spacing.md,
    padding: spacing.md,
  },
  summaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  iconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  summaryLabel: {
    ...typography.micro,
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  summaryValue: {
    ...typography.h3,
    color: colors.text,
    marginTop: 2,
  },
  card: {
    marginHorizontal: spacing.md,
    padding: spacing.md,
  },
  label: {
    ...typography.caption,
    fontWeight: '600',
    color: colors.textMuted,
    marginBottom: spacing.xs,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  phoneInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.xs,
  },
  countryCodeBadge: {
    paddingRight: spacing.sm,
    justifyContent: 'center',
  },
  countryCodeText: {
    ...typography.body,
    fontSize: 16,
    fontWeight: '700',
    color: colors.primary,
    letterSpacing: 0.5,
  },
  divider: {
    width: 1.5,
    height: 22,
    backgroundColor: colors.border,
    marginRight: spacing.sm,
  },
  input: {
    ...typography.body,
    color: colors.text,
    paddingVertical: spacing.xs,
    fontSize: 16,
    flex: 1,
  },
  clearBtn: {
    paddingLeft: spacing.xs,
    justifyContent: 'center',
    alignItems: 'center',
  },
  saveButton: {
    marginHorizontal: spacing.md,
    marginTop: spacing.lg,
  },
});
