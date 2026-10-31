// "Type the tag number": for a tag that won't scan (torn or faded), or a Bluetooth
// tag scanner, which types into this box by itself. Digits alone mean NH (3302 → NH3302).
import { useState } from 'react';
import { KeyboardAvoidingView, Modal, Pressable, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../theme/ThemeProvider';
import { Button } from '../Button';
import { T } from '../T';
import { isValidTag, typedTag } from '../../utils/products';

export function TagEntryModal({ visible, title = 'Type the tag number', note, onSubmit, onClose }) {
  const { c, radius, type } = useTheme();
  const insets = useSafeAreaInsets();
  const [text, setText] = useState('');
  const [error, setError] = useState(null);
  const close = () => { setText(''); setError(null); onClose(); };
  function submit() {
    const code = typedTag(text);
    if (!isValidTag(code)) { setError('Enter the number on the tag, like 3302 or NH3302.'); return; }
    setText(''); setError(null);
    onSubmit(code);
  }
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={close} statusBarTranslucent>
      <KeyboardAvoidingView behavior="padding" style={{ flex: 1 }}>
        <Pressable onPress={close} style={{ flex: 1, backgroundColor: c.overlay, justifyContent: 'flex-end', padding: 12, paddingBottom: Math.max(insets.bottom, 12) }}>
          <Pressable onPress={() => {}} style={{ backgroundColor: c.surface, borderRadius: radius.xl, padding: 20, width: '100%', maxWidth: 460, alignSelf: 'center', gap: 10 }}>
            <T variant="barTitle">{title}</T>
            <T variant="small" color="text2">{note || 'The number printed on the tag. Typing only digits adds NH (3302 → NH3302). A Bluetooth tag scanner types here by itself.'}</T>
            <TextInput value={text} onChangeText={(v) => { setText(v); setError(null); }} autoFocus autoCapitalize="characters" autoCorrect={false} spellCheck={false}
              placeholder="NH3302" placeholderTextColor={c.muted} returnKeyType="done" onSubmitEditing={submit} accessibilityLabel="Tag number" maxLength={64}
              style={[type.barTitle, { letterSpacing: 1, minHeight: 54, borderWidth: 1.5, borderColor: error ? c.danger : c.borderStrong, borderRadius: radius.md, paddingHorizontal: 14, color: c.text, backgroundColor: c.bg }]} />
            {error ? <T variant="small" color="danger">{error}</T> : null}
            <View style={{ flexDirection: 'row', gap: 10, marginTop: 4 }}>
              <Button title="Cancel" kind="secondary" onPress={close} style={{ flex: 1 }} />
              <Button title="Use" onPress={submit} style={{ flex: 1 }} />
            </View>
          </Pressable>
        </Pressable>
      </KeyboardAvoidingView>
    </Modal>
  );
}
