import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { Modal, View, Text, StyleSheet, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Button from './ui/Button';
import { colors, radius, shadow, spacing, typography } from '../utils/theme';

type IconName = keyof typeof Ionicons.glyphMap;

export type DialogTone = 'info' | 'success' | 'warning' | 'danger';

export interface DialogAction {
  label: string;
  onPress?: () => void;
  variant?: 'primary' | 'secondary' | 'destructive';
}

export interface DialogOptions {
  title: string;
  message?: string;
  tone?: DialogTone;
  /** Defaults to a single "OK" that just dismisses. */
  actions?: DialogAction[];
  /** Whether tapping the backdrop dismisses. Off for anything asking a real question. */
  dismissOnBackdrop?: boolean;
}

const TONE: Record<DialogTone, { icon: IconName; color: string; bg: string }> = {
  info: { icon: 'information-circle', color: colors.primary, bg: colors.primaryBg },
  success: { icon: 'checkmark-circle', color: colors.success, bg: colors.successBg },
  warning: { icon: 'alert-circle', color: colors.warning, bg: colors.warningBg },
  danger: { icon: 'warning', color: colors.error, bg: colors.errorBg },
};

const DialogContext = createContext<((options: DialogOptions) => void) | null>(null);

/**
 * The app's own confirm/notify dialog, replacing React Native's Alert.alert.
 *
 * Alert.alert renders the *operating system's* dialog: a stark square box in
 * the platform's own font and blue system buttons, which looked like it
 * belonged to a different application every time it appeared mid-flow (most
 * visibly right after creating a product). This one is built from the same
 * pieces as the rest of the app — card surface, pill buttons, maroon accent —
 * so a confirmation reads as part of the screen it came from.
 *
 * Mounted once at the root; screens call `useDialog()` and get a function
 * with the same shape as the old Alert.alert call they replaced.
 */
export function DialogProvider({ children }: { children: React.ReactNode }) {
  const [options, setOptions] = useState<DialogOptions | null>(null);

  const showDialog = useCallback((next: DialogOptions) => setOptions(next), []);
  const dismiss = useCallback(() => setOptions(null), []);

  const runAction = useCallback(
    (action: DialogAction) => {
      // Closed before the handler runs, so an action that navigates doesn't
      // leave a dialog floating over the screen it moved to.
      setOptions(null);
      action.onPress?.();
    },
    []
  );

  const value = useMemo(() => showDialog, [showDialog]);
  const tone = TONE[options?.tone ?? 'info'];
  const actions = options?.actions?.length ? options.actions : [{ label: 'OK' }];

  return (
    <DialogContext.Provider value={value}>
      {children}
      <Modal
        visible={options !== null}
        transparent
        animationType="fade"
        onRequestClose={dismiss}
        statusBarTranslucent
      >
        <View style={styles.backdrop}>
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={options?.dismissOnBackdrop === false ? undefined : dismiss}
          />
          <View style={styles.card}>
            <View style={[styles.iconWrap, { backgroundColor: tone.bg }]}>
              <Ionicons name={tone.icon} size={24} color={tone.color} />
            </View>
            <Text style={styles.title}>{options?.title}</Text>
            {options?.message ? <Text style={styles.message}>{options.message}</Text> : null}
            <View style={styles.actions}>
              {actions.map((action, index) => (
                <Button
                  key={action.label}
                  title={action.label}
                  variant={action.variant ?? (index === 0 ? 'primary' : 'secondary')}
                  onPress={() => runAction(action)}
                  style={index > 0 ? styles.secondAction : undefined}
                />
              ))}
            </View>
          </View>
        </View>
      </Modal>
    </DialogContext.Provider>
  );
}

export function useDialog() {
  const ctx = useContext(DialogContext);
  if (!ctx) throw new Error('useDialog must be used within a DialogProvider');
  return ctx;
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(43, 37, 35, 0.45)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
  },
  card: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    padding: spacing.xl,
    alignItems: 'center',
    ...shadow.floating,
  },
  iconWrap: {
    width: 52, height: 52, borderRadius: radius.pill,
    alignItems: 'center', justifyContent: 'center',
  },
  title: { ...typography.h2, color: colors.text, textAlign: 'center', marginTop: spacing.md },
  message: {
    ...typography.bodySm, color: colors.textLabel, textAlign: 'center',
    marginTop: spacing.sm, lineHeight: 20,
  },
  actions: { alignSelf: 'stretch', marginTop: spacing.xl },
  secondAction: { marginTop: spacing.sm },
});
