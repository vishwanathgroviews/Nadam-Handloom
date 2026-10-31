// Design choice A: six boxes with the phone's own number keyboard. Digits show as
// dots, with a Show/Hide button. Shakes on a wrong entry.
import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { Animated, Keyboard, Pressable, TextInput, View } from 'react-native';
import { useTheme } from '../theme/ThemeProvider';
import { Icon } from './Icon';
import { T } from './T';

export const PinBoxes = forwardRef(function PinBoxes({ value, onChange, onComplete, onSubmit, length = 6, maxLength = 6, label = 'PIN', error = false, autoFocus = true, rightTool }, ref) {
  const { c, radius, type } = useTheme();
  const input = useRef(null);
  const shake = useRef(new Animated.Value(0)).current;
  const [show, setShow] = useState(false);
  const [focused, setFocused] = useState(false);

  useImperativeHandle(ref, () => ({
    focus: () => input.current?.focus(),
    shake: () => {
      shake.setValue(0);
      Animated.sequence([-8, 7, -5, 3, 0].map((x) => Animated.timing(shake, { toValue: x, duration: 60, useNativeDriver: true }))).start();
    },
  }));

  // Android can leave the keyboard open when a focused input goes away (and that
  // stalls the next screen's entry animation): always close it on the way out.
  useEffect(() => () => Keyboard.dismiss(), []);

  useEffect(() => {
    if (autoFocus) {
      const t = setTimeout(() => input.current?.focus(), 350);
      return () => clearTimeout(t);
    }
    return undefined;
  }, [autoFocus]);

  const boxes = Array.from({ length }, (_, i) => i);
  return (
    <View style={{ gap: 8 }}>
      <T variant="smallStrong" color="text2">{label}</T>
      <Pressable onPress={() => input.current?.focus()} accessible={false}>
        <Animated.View style={{ flexDirection: 'row', gap: 8, transform: [{ translateX: shake }] }}>
          {boxes.map((i) => {
            const filled = i < value.length;
            const current = focused && i === Math.min(value.length, length - 1) && value.length < maxLength;
            return (
              <View key={i} style={{ flex: 1, height: 56, borderRadius: radius.md, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center', backgroundColor: c.surface,
                borderColor: error ? c.danger : current ? c.primary : filled ? c.text2 : c.borderStrong }}>
                <T style={type.mono}>{filled ? (show ? value[i] : '•') : ''}</T>
              </View>
            );
          })}
        </Animated.View>
      </Pressable>
      <TextInput
        ref={input}
        value={value}
        onChangeText={(t) => {
          const v = t.replace(/\D/g, '').slice(0, maxLength);
          onChange(v);
          if (v.length === maxLength) onComplete?.(v);
        }}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        keyboardType="number-pad"
        returnKeyType="done"
        onSubmitEditing={() => onSubmit?.(value)}
        submitBehavior="submit"
        maxLength={maxLength}
        textContentType="none"
        autoComplete="off"
        importantForAutofill="no"
        secureTextEntry={false}
        caretHidden
        accessibilityLabel={`${label}, ${value.length} of ${length} digits entered`}
        style={{ position: 'absolute', opacity: 0, height: 1, width: 1 }}
      />
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', minHeight: 32 }}>
        <Pressable accessibilityRole="button" onPress={() => setShow((s) => !s)} hitSlop={8} style={{ flexDirection: 'row', gap: 6, alignItems: 'center' }}>
          <Icon name={show ? 'eyeoff' : 'eye'} size={17} color={c.text2} />
          <T variant="caption" color="text2">{show ? 'Hide' : 'Show'}</T>
        </Pressable>
        {rightTool}
      </View>
    </View>
  );
});
