import React from 'react';
import { KeyboardAvoidingView, StyleProp, ViewStyle } from 'react-native';

interface Props {
  style?: StyleProp<ViewStyle>;
  /**
   * Extra space to keep above the keyboard. Every screen in this app draws
   * its own ScreenHeader inside the scroll view (the navigators all run with
   * headerShown: false), so there is no native header to offset for and the
   * default of 0 is right almost everywhere.
   */
  keyboardVerticalOffset?: number;
  children: React.ReactNode;
}

/**
 * Lifts screen content clear of the on-screen keyboard.
 *
 * Every screen used to do this inline with
 * `behavior={Platform.OS === 'ios' ? 'padding' : undefined}`. On Android
 * `undefined` makes KeyboardAvoidingView a no-op — it assumes the window
 * itself shrinks via `adjustResize`. That assumption stopped holding when
 * Expo made edge-to-edge mandatory: the app now draws behind the system
 * bars, the window no longer resizes for the keyboard, and the keyboard
 * simply covered whichever field was focused.
 *
 * `padding` works on both platforms, because it measures the keyboard from
 * the keyboard events rather than relying on the window resizing. Shrinking
 * the container this way is also what lets the inner ScrollView scroll the
 * focused field back into view. Wrapping it here keeps that decision in one
 * place instead of re-derived on every screen.
 */
export default function KeyboardAwareScreen({ style, keyboardVerticalOffset = 0, children }: Props) {
  return (
    <KeyboardAvoidingView style={style} behavior="padding" keyboardVerticalOffset={keyboardVerticalOffset}>
      {children}
    </KeyboardAvoidingView>
  );
}
