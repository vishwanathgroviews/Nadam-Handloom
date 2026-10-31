// The SMS code: six boxes with visible digits. iPhone offers the code above the
// keyboard (oneTimeCode); Android's keyboard suggests it (sms-otp autofill).
import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';
import { Keyboard, Platform, Pressable, TextInput, View } from 'react-native';
import { useTheme } from '../theme/ThemeProvider';
import { T } from './T';

export const CodeBoxes = forwardRef(function CodeBoxes({ value, onChange, onComplete, error = false }, ref) {
  const { c, radius, type } = useTheme();
  const input = useRef(null);
  useImperativeHandle(ref, () => ({ focus: () => input.current?.focus() }));
  useEffect(() => () => Keyboard.dismiss(), []); // see PinBoxes

  useEffect(() => {
    const t = setTimeout(() => input.current?.focus(), 350);
    return () => clearTimeout(t);
  }, []);
  return (
    <View>
      <Pressable onPress={() => input.current?.focus()} accessible={false} style={{ flexDirection: 'row', gap: 8 }}>
        {Array.from({ length: 6 }, (_, i) => (
          <View key={i} style={{ flex: 1, height: 58, borderRadius: radius.md, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center', backgroundColor: c.surface,
            borderColor: error ? c.danger : i === value.length ? c.primary : i < value.length ? c.text2 : c.borderStrong }}>
            <T style={type.mono}>{value[i] || ''}</T>
          </View>
        ))}
      </Pressable>
      <TextInput
        ref={input}
        value={value}
        onChangeText={(t) => {
          const v = t.replace(/\D/g, '').slice(0, 6);
          onChange(v);
          if (v.length === 6) onComplete?.(v);
        }}
        keyboardType="number-pad"
        textContentType="oneTimeCode"
        autoComplete={Platform.select({ android: 'sms-otp', default: 'one-time-code' })}
        maxLength={6}
        caretHidden
        accessibilityLabel={`SMS code, ${value.length} of 6 digits entered`}
        style={{ position: 'absolute', opacity: 0, height: 1, width: 1 }}
      />
    </View>
  );
});
