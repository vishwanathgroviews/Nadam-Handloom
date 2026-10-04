import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { colors, spacing, typography } from '../utils/theme';

// The server sends a new code at most once a minute.
const RESEND_WAIT_MS = 60 * 1000;

interface Props {
  /** Asks the server for a new code. A rejection's message is shown to the user. */
  onResend: () => Promise<void>;
  onError: (message: string) => void;
}

/**
 * The "Resend code" line under an OTP box, locked for a minute after each
 * code goes out — the screen it sits on is only reached once a code has just
 * been sent, so it starts locked.
 *
 * It counts down to a point in time rather than decrementing a number, so the
 * wait is still right after the app has been in the background (reading the
 * SMS is exactly when that happens).
 */
export default function ResendCode({ onResend, onError }: Props) {
  const [availableAt, setAvailableAt] = useState(() => Date.now() + RESEND_WAIT_MS);
  const [now, setNow] = useState(() => Date.now());
  const [sending, setSending] = useState(false);
  const [resent, setResent] = useState(false);

  const secondsLeft = Math.max(0, Math.ceil((availableAt - now) / 1000));
  const waiting = secondsLeft > 0;

  useEffect(() => {
    if (!waiting) return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [waiting]);

  const handlePress = async () => {
    setSending(true);
    try {
      await onResend();
      setResent(true);
      setAvailableAt(Date.now() + RESEND_WAIT_MS);
      setNow(Date.now());
    } catch (err: any) {
      onError(err?.message || 'Could not send a new code');
    } finally {
      setSending(false);
    }
  };

  return (
    <View style={styles.row}>
      {sending ? (
        <ActivityIndicator size="small" color={colors.primary} />
      ) : waiting ? (
        <Text style={styles.text}>
          {resent ? 'New code sent. ' : ''}Resend code in {secondsLeft}s
        </Text>
      ) : (
        <TouchableOpacity onPress={handlePress} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Text style={styles.text}>
            Didn't get the code? <Text style={styles.link}>Resend code</Text>
          </Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { alignItems: 'center', justifyContent: 'center', minHeight: 24, marginTop: spacing.lg },
  text: { ...typography.bodySm, color: colors.textMuted, textAlign: 'center' },
  link: { color: colors.primary, fontFamily: 'Outfit_700Bold' },
});
