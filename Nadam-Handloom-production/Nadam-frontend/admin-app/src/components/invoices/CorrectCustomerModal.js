// Correct the customer on an invoice (owners, the invoice's own month, decision 6.11):
// the name or mobile. The number, date and amounts never change; the PDF is made again.
import { useState } from 'react';
import { KeyboardAvoidingView, Modal, Pressable } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../theme/ThemeProvider';
import { Button } from '../Button';
import { MobileField } from '../MobileField';
import { TextField } from '../TextField';
import { T } from '../T';
import { correctErrors } from '../../utils/invoices';
import { digitsOnly } from '../../utils/phone';

export function CorrectCustomerModal({ visible, invoice, busy, onClose, onSave }) {
  const { c, radius } = useTheme();
  const insets = useSafeAreaInsets();
  const [name, setName] = useState(invoice?.customerName || '');
  const [mobile, setMobile] = useState(digitsOnly(invoice?.mobile || '').slice(-10));
  const [errors, setErrors] = useState({});
  function save() {
    const e = correctErrors({ name, mobile });
    setErrors(e);
    if (!Object.keys(e).length) onSave({ name: name.trim(), mobile });
  }
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={busy ? undefined : onClose} statusBarTranslucent>
      <KeyboardAvoidingView behavior="padding" style={{ flex: 1 }}>
        <Pressable onPress={busy ? undefined : onClose} style={{ flex: 1, backgroundColor: c.overlay, justifyContent: 'flex-end', padding: 12, paddingBottom: Math.max(insets.bottom, 12) }}>
          <Pressable onPress={() => {}} style={{ backgroundColor: c.surface, borderRadius: radius.xl, padding: 20, width: '100%', maxWidth: 460, alignSelf: 'center' }}>
            <T variant="barTitle">Correct the customer</T>
            <T variant="small" color="text2" style={{ marginTop: 4, marginBottom: 12 }}>{invoice?.number} keeps its number, date and amounts. The PDF is made again and the change is recorded in the activity log.</T>
            <TextField label="Name" value={name} onChange={(v) => { setName(v); setErrors((e) => ({ ...e, name: null })); }} error={errors.name} maxLength={60} autoCapitalize="words" placeholder="Customer's name" />
            <MobileField value={mobile} onChange={(v) => { setMobile(v); setErrors((e) => ({ ...e, mobile: null })); }} error={errors.mobile} hint="Leave empty if the customer gave none." />
            <Button title="Save and make the PDF again" loading={busy} onPress={save} />
            <Button title="Cancel" kind="ghost" disabled={busy} onPress={onClose} style={{ marginTop: 6 }} />
          </Pressable>
        </Pressable>
      </KeyboardAvoidingView>
    </Modal>
  );
}
