// Pieces of the Settings page (Module 11): a section card, "Last changed", a list of
// facts, a version box, and the sheet that pauses the staff app or the website.
import { useState } from 'react';
import { KeyboardAvoidingView, Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../theme/ThemeProvider';
import { Button } from '../Button';
import { Icon } from '../Icon';
import { TextField } from '../TextField';
import { T } from '../T';
import { MESSAGE_MAX } from '../../utils/settings';

export function Section({ icon, title, children }) {
  const { c, radius } = useTheme();
  return (
    <View style={{ backgroundColor: c.surface, borderWidth: 1, borderColor: c.border, borderRadius: radius.lg, padding: 16, gap: 12 }}>
      <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
        <Icon name={icon} size={18} color={c.primary} />
        <T variant="bodyStrong" accessibilityRole="header">{title}</T>
      </View>
      {children}
    </View>
  );
}

export function LastChanged({ text }) {
  const { c } = useTheme();
  return (
    <View style={{ flexDirection: 'row', gap: 6, alignItems: 'center' }}>
      <Icon name="history" size={14} color={c.muted} />
      <T variant="caption" color="muted" style={{ flex: 1 }}>Last changed: {text}</T>
    </View>
  );
}

// items: [label, value, warn?]
export function InfoList({ items }) {
  const { c } = useTheme();
  return (
    <View>
      {items.map(([label, value, warn], i) => (
        <View key={label} style={{ paddingVertical: 8, borderTopWidth: i ? 1 : 0, borderTopColor: c.border, gap: 1 }}>
          <T variant="caption" color="muted">{label}</T>
          <T variant="small" color={warn ? 'warning' : 'text'} style={warn ? { fontFamily: 'PlusJakartaSans_600SemiBold' } : null}>{value}</T>
        </View>
      ))}
    </View>
  );
}

export function VerBox({ label, value }) {
  const { c, radius } = useTheme();
  return (
    <View style={{ flex: 1, padding: 10, borderRadius: radius.md, backgroundColor: c.surface2, gap: 2 }}>
      <T variant="caption" color="muted">{label}</T>
      <T variant="bodyStrong" numberOfLines={1} adjustsFontSizeToFit>{value}</T>
    </View>
  );
}

// Turning maintenance on asks first, with the message people will see (6.2).
const PAUSE = {
  staff: { title: 'Pause the staff app?', text: 'Staff will see your message and can\'t sell or ship until you turn it off. Owners keep working.', label: 'Message for staff', placeholder: 'Updating prices, back at 6 pm', yes: 'Pause the staff app', kind: 'dangerSolid' },
  website: { title: 'Pause the website?', text: 'Customers see your message instead of the shop.', label: 'Message for customers', placeholder: 'Our website is being updated. Please come back soon.', yes: 'Pause the website', kind: 'primary' },
};
export function PauseSheet({ which, message, busy, onClose, onPause }) {
  const { c, radius } = useTheme();
  const insets = useSafeAreaInsets();
  const [text, setText] = useState(message || '');
  const p = PAUSE[which];
  if (!p) return null;
  return (
    <Modal visible transparent animationType="fade" onRequestClose={busy ? undefined : onClose} statusBarTranslucent>
      <KeyboardAvoidingView behavior="padding" style={{ flex: 1 }}>
        <View style={{ flex: 1, backgroundColor: c.overlay, justifyContent: 'flex-end', padding: 12, paddingBottom: Math.max(insets.bottom, 12) }}>
          {/* The dark background closes the sheet; it sits behind the sheet, so drags inside the sheet always scroll it. */}
          <Pressable accessibilityLabel="Close" onPress={busy ? undefined : onClose} style={StyleSheet.absoluteFill} />
          <View style={{ backgroundColor: c.surface, borderRadius: radius.xl, padding: 20, width: '100%', maxWidth: 460, alignSelf: 'center', maxHeight: '90%' }}>
            <ScrollView keyboardShouldPersistTaps="handled">
              <T variant="barTitle">{p.title}</T>
              <T variant="small" color="text2" style={{ marginTop: 6, marginBottom: 14 }}>{p.text}</T>
              <TextField autoComplete="off" label={p.label} value={text} onChange={setText} placeholder={p.placeholder} multiline maxLength={MESSAGE_MAX} hint={`${text.length}/${MESSAGE_MAX}`} />
              <View style={{ gap: 8, marginTop: 4 }}>
                <Button title={p.yes} kind={p.kind} loading={busy} onPress={() => onPause(text)} />
                <Button title="Cancel" kind="ghost" disabled={busy} onPress={onClose} />
              </View>
            </ScrollView>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
