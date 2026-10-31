// Dialogs (always ask before anything that can't be undone) and toasts (confirm
// small things). One provider at the top of the app; screens call useFeedback().
import { createContext, useCallback, useContext, useRef, useState } from 'react';
import { Animated, Modal, Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme, useIsTablet } from '../theme/ThemeProvider';
import { Button } from './Button';
import { Icon } from './Icon';
import { T } from './T';

const FeedbackContext = createContext(null);

export function FeedbackProvider({ children }) {
  const { c, radius } = useTheme();
  const tablet = useIsTablet();
  const insets = useSafeAreaInsets();
  const [dialog, setDialog] = useState(null);
  const [toast, setToast] = useState(null);
  const [fade] = useState(() => new Animated.Value(0));
  const timer = useRef(null);

  const showToast = useCallback((text, tone = 'info') => {
    clearTimeout(timer.current);
    setToast({ text, tone });
    fade.setValue(0);
    Animated.timing(fade, { toValue: 1, duration: 180, useNativeDriver: true }).start();
    timer.current = setTimeout(() => Animated.timing(fade, { toValue: 0, duration: 220, useNativeDriver: true }).start(() => setToast(null)), 2800);
  }, [fade]);

  // confirm({ title, text, content, tone, icon, actions: [{ label, kind, onPress }] }) -> closes on press
  const confirm = useCallback((d) => setDialog(d), []);
  const close = () => setDialog(null);

  const toneColors = { danger: [c.dangerSoft, c.danger], warning: [c.warningSoft, c.warning], info: [c.infoSoft, c.info] };
  const [icoBg, icoFg] = toneColors[dialog?.tone || 'info'];

  return (
    <FeedbackContext.Provider value={{ showToast, confirm }}>
      {children}
      <Modal visible={!!dialog} transparent animationType="fade" onRequestClose={close} statusBarTranslucent>
        <Pressable onPress={dialog?.sticky ? undefined : close} style={{ flex: 1, backgroundColor: c.overlay, justifyContent: tablet ? 'center' : 'flex-end', padding: 12, paddingBottom: Math.max(insets.bottom, 12) }}>
          <Pressable accessibilityRole="alert" onPress={() => {}} style={{ backgroundColor: c.surface, borderRadius: radius.xl, padding: 22, width: '100%', maxWidth: 440, alignSelf: 'center' }}>
            {dialog ? (
              <>
                <View style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: icoBg, alignItems: 'center', justifyContent: 'center', marginBottom: 12 }}>
                  <Icon name={dialog.icon || 'info'} color={icoFg} />
                </View>
                <T variant="barTitle">{dialog.title}</T>
                {dialog.text ? <T variant="small" color="text2" style={{ marginTop: 6 }}>{dialog.text}</T> : null}
                {dialog.content || null}
                <View style={{ gap: 8, marginTop: 18 }}>
                  {dialog.actions.map((a) => (
                    <Button key={a.label} title={a.label} kind={a.kind || 'secondary'} onPress={() => { close(); a.onPress?.(); }} />
                  ))}
                </View>
              </>
            ) : null}
          </Pressable>
        </Pressable>
      </Modal>
      {toast ? (
        <Animated.View pointerEvents="none" style={{ position: 'absolute', left: 20, right: 20, bottom: insets.bottom + 100, alignItems: 'center', opacity: fade }}>
          <View accessibilityLiveRegion="polite" style={{ flexDirection: 'row', gap: 8, alignItems: 'center', backgroundColor: c.text, paddingVertical: 11, paddingHorizontal: 16, borderRadius: radius.xl, maxWidth: 520 }}>
            <Icon name={toast.tone === 'success' ? 'check' : 'info'} size={18} color={toast.tone === 'success' ? '#4ADE80' : c.bg} />
            <T variant="smallStrong" color={c.bg} style={{ flexShrink: 1 }}>{toast.text}</T>
          </View>
        </Animated.View>
      ) : null}
    </FeedbackContext.Provider>
  );
}

export const useFeedback = () => useContext(FeedbackContext);
