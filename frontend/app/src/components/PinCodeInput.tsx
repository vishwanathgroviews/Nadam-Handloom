import React, { useRef } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet } from 'react-native';
import { colors, radius, spacing, typography } from '../utils/theme';

interface Props {
  value: string;
  onChangeText: (value: string) => void;
  length?: number;
  autoFocus?: boolean;
}

// Shows each digit as it's typed instead of only a filled/unfilled progress
// bar — used by every MPIN/OTP entry screen (login, setup, reset, activation)
// so the number being entered is always visible.
export default function PinCodeInput({ value, onChangeText, length = 6, autoFocus }: Props) {
  const inputRef = useRef<TextInput>(null);

  return (
    <TouchableOpacity activeOpacity={1} onPress={() => inputRef.current?.focus()}>
      <View style={styles.row}>
        {Array.from({ length }).map((_, i) => (
          <View key={i} style={[styles.box, i < value.length && styles.boxFilled]}>
            <Text style={styles.digit}>{value[i] ?? ''}</Text>
          </View>
        ))}
      </View>
      <TextInput
        ref={inputRef}
        style={styles.hiddenInput}
        keyboardType="number-pad"
        maxLength={length}
        value={value}
        onChangeText={(v) => onChangeText(v.replace(/\D/g, ''))}
        autoFocus={autoFocus}
      />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 10, marginTop: spacing.md },
  box: {
    flex: 1,
    height: 48,
    borderRadius: radius.md,
    backgroundColor: colors.inputBg,
    borderWidth: 1.5,
    borderColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
  },
  boxFilled: { borderColor: colors.primary },
  digit: { ...typography.h2, color: colors.text },
  hiddenInput: { position: 'absolute', opacity: 0, height: 0, width: 0 },
});
