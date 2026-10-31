// A full-screen scanner for one tag (Change tag, Replace a damaged tag, fixing a
// saree whose tag was taken). Scan, or type the number.
import { useState } from 'react';
import { Modal, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../theme/ThemeProvider';
import { Button } from '../Button';
import { Banner } from '../Banner';
import { T } from '../T';
import { ScanFrame, TagScanner } from './TagScanner';
import { TagEntryModal } from './TagEntryModal';

// hint: what to point at; allowType={false} when the screen behind has its own box
// (Module 7's courier labels).
export function ScanTagModal({ visible, title, text, note, error, busy, onCode, onClose, hint = 'Point at the new tag', allowType = true }) {
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  const [typing, setTyping] = useState(false);
  const [torch, setTorch] = useState(false);
  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <View style={{ flex: 1, backgroundColor: c.bg, paddingTop: insets.top + 8, paddingBottom: Math.max(insets.bottom, 16), paddingHorizontal: 16, gap: 10 }}>
        <T variant="barTitle">{title}</T>
        {text ? <T variant="small" color="text2">{text}</T> : null}
        {note ? <Banner tone="info" text={note} /> : null}
        {error ? <Banner tone="error" title={error.title} text={error.text} /> : null}
        <TagScanner onCode={onCode} paused={busy || typing || !visible} torch={torch} style={{ flex: 1, minHeight: 240 }}>
          <View style={{ flex: 1, justifyContent: 'center', paddingHorizontal: '12%' }}>
            <ScanFrame hint={busy ? 'Checking…' : hint} />
          </View>
        </TagScanner>
        <View style={{ flexDirection: 'row', gap: 10 }}>
          {allowType ? <Button title="Type" icon="keyboard" kind="secondary" onPress={() => setTyping(true)} style={{ flex: 1 }} /> : null}
          <Button title={torch ? 'Torch off' : 'Torch'} icon="flash" kind="secondary" onPress={() => setTorch((t) => !t)} style={{ flex: 1 }} />
        </View>
        <Button title="Cancel" kind="ghost" onPress={onClose} />
      </View>
      <TagEntryModal visible={typing} title={title} onClose={() => setTyping(false)} onSubmit={(code) => { setTyping(false); onCode(code); }} />
    </Modal>
  );
}
