// Ship an order, or change its tracking number (Module 7, 5.3). Courier: DTDC or
// another by name (6.4). The number: scan the courier label with the camera or type
// it; a number already on another order is refused by the server (6.5).
import { useState } from 'react';
import { KeyboardAvoidingView, Modal, Pressable, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../theme/ThemeProvider';
import { Button } from '../Button';
import { Icon } from '../Icon';
import { T } from '../T';
import { TextField } from '../TextField';
import { ChoiceGroup } from '../sales/SaleParts';
import { ScanTagModal } from '../products/ScanTagModal';
import { AWB_HINT, isAwb, tidyAwb } from '../../utils/orders';

export function ShipModal({ visible, order, change = false, busy, error, onSubmit, onClose }) {
  const { c, radius, type } = useTheme();
  const insets = useSafeAreaInsets();
  const current = change ? order.carrier : 'DTDC';
  const [courier, setCourier] = useState(current && current !== 'DTDC' ? 'other' : 'DTDC');
  const [name, setName] = useState(current && current !== 'DTDC' ? current : '');
  const [awb, setAwb] = useState('');
  const [problem, setProblem] = useState(null);
  const [scanning, setScanning] = useState(false);
  const shown = problem || error;
  function submit() {
    const number = tidyAwb(awb);
    if (courier === 'other' && name.trim().length < 2) { setProblem('Type the courier\'s name.'); return; }
    if (!isAwb(number)) { setProblem(AWB_HINT); return; }
    if (change && number === order.awb && (courier === 'DTDC' ? 'DTDC' : name.trim()) === order.carrier) { setProblem('That is already this order\'s number.'); return; }
    setProblem(null);
    onSubmit({ carrier: courier === 'DTDC' ? 'DTDC' : name.trim(), awb: number });
  }
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={busy ? undefined : onClose} statusBarTranslucent>
      <KeyboardAvoidingView behavior="padding" style={{ flex: 1 }}>
        <Pressable onPress={busy ? undefined : onClose} style={{ flex: 1, backgroundColor: c.overlay, justifyContent: 'flex-end', padding: 12, paddingBottom: Math.max(insets.bottom, 12) }}>
          <Pressable onPress={() => {}} style={{ backgroundColor: c.surface, borderRadius: radius.xl, padding: 20, width: '100%', maxWidth: 460, alignSelf: 'center' }}>
            <T variant="barTitle">{change ? 'Change tracking number' : `Ship ${order.orderNumber}`}</T>
            <T variant="small" color="text2" style={{ marginTop: 4, marginBottom: 12 }}>{change ? `The old number (${order.awb}) stays in the order's history.` : 'Put the courier label on the parcel, then scan its barcode or type the number.'}</T>
            <ChoiceGroup label="Courier" value={courier} onChange={(v) => { setCourier(v); setProblem(null); }} options={[['DTDC', 'DTDC', 'orders'], ['other', 'Another courier', 'edit']]} />
            {courier === 'other' ? <TextField label="Courier name" value={name} onChange={(v) => { setName(v); setProblem(null); }} maxLength={40} autoCapitalize="words" placeholder="India Post, Professional…" /> : null}
            <T variant="smallStrong" color="text2" nativeID="awb-label">Tracking number (AWB)</T>
            <View style={{ flexDirection: 'row', gap: 8, marginTop: 6 }}>
              <TextInput value={awb} onChangeText={(v) => { setAwb(v); setProblem(null); }} autoCapitalize="characters" autoCorrect={false} spellCheck={false} maxLength={40}
                placeholder="H1001830820" placeholderTextColor={c.borderStrong} accessibilityLabel="Tracking number" accessibilityLabelledBy="awb-label" returnKeyType="done" onSubmitEditing={submit}
                style={[type.bodyStrong, { flex: 1, minHeight: 52, borderWidth: 1.5, borderColor: shown ? c.danger : c.borderStrong, borderRadius: radius.md, paddingHorizontal: 14, color: c.text, backgroundColor: c.bg, letterSpacing: 0.5 }]} />
              <Pressable accessibilityRole="button" accessibilityLabel="Scan the label" onPress={() => setScanning(true)}
                style={{ width: 52, height: 52, borderRadius: radius.md, borderWidth: 1.5, borderColor: c.borderStrong, alignItems: 'center', justifyContent: 'center', backgroundColor: c.surface }}>
                <Icon name="barcode" color={c.text} />
              </Pressable>
            </View>
            {shown ? <T variant="caption" color="danger" accessibilityRole="alert" style={{ marginTop: 6 }}>{shown}</T> : null}
            <View style={{ gap: 8, marginTop: 16 }}>
              <Button title={change ? 'Save the new number' : 'Mark shipped'} icon={change ? 'check' : 'send'} loading={busy} onPress={submit} />
              <Button title="Cancel" kind="ghost" disabled={busy} onPress={onClose} />
            </View>
          </Pressable>
        </Pressable>
      </KeyboardAvoidingView>
      <ScanTagModal visible={scanning} title="Scan the courier label" text="Point the camera at the label's barcode." hint="Point at the label's barcode" allowType={false}
        onClose={() => setScanning(false)} onCode={(code) => { setScanning(false); setAwb(tidyAwb(code)); setProblem(null); }} />
    </Modal>
  );
}
