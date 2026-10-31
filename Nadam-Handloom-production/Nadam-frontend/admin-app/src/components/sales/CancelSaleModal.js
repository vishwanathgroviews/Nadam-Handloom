// Cancel a sale (owners, same day, decision 6.2): pick a reason (or type one), then
// confirm. The sarees go back in stock and the invoice is kept, marked CANCELLED.
import { useState } from 'react';
import { KeyboardAvoidingView, Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../theme/ThemeProvider';
import { Button } from '../Button';
import { TextField } from '../TextField';
import { T } from '../T';
import { CANCEL_REASONS, plural } from '../../utils/sales';

export function CancelSaleModal({ visible, sale, busy, onClose, onCancel }) {
  const { c, radius } = useTheme();
  const insets = useSafeAreaInsets();
  const [pick, setPick] = useState(null);
  const [other, setOther] = useState('');
  const reason = pick === 'other' ? other.trim() : pick;
  const close = () => { setPick(null); setOther(''); onClose(); };
  const n = sale?.lines.length ?? 0;
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={close} statusBarTranslucent>
      <KeyboardAvoidingView behavior="padding" style={{ flex: 1 }}>
        <View style={{ flex: 1, backgroundColor: c.overlay, justifyContent: 'flex-end', padding: 12, paddingBottom: Math.max(insets.bottom, 12) }}>
          {/* The dark background closes the sheet; it sits behind the sheet, so drags inside the sheet always scroll it. */}
          <Pressable accessibilityLabel="Close" onPress={busy ? undefined : close} style={StyleSheet.absoluteFill} />
          <View style={{ backgroundColor: c.surface, borderRadius: radius.xl, padding: 20, width: '100%', maxWidth: 460, alignSelf: 'center', maxHeight: '90%' }}>
            <ScrollView keyboardShouldPersistTaps="handled">
              <T variant="barTitle">Cancel this sale?</T>
              <T variant="small" color="text2" style={{ marginTop: 6 }}>
                {plural(n, 'saree goes', 'sarees go')} back in stock{sale?.invoice?.number ? ` and invoice ${sale.invoice.number} is marked CANCELLED (kept, never deleted)` : ''}. Why?
              </T>
              <View style={{ gap: 8, marginTop: 12 }}>
                {[...CANCEL_REASONS, 'other'].map((r) => {
                  const on = pick === r;
                  return (
                    <Pressable key={r} accessibilityRole="radio" accessibilityState={{ checked: on }} onPress={() => setPick(r)}
                      style={{ minHeight: 46, justifyContent: 'center', paddingHorizontal: 14, borderRadius: radius.md, borderWidth: 1.5, borderColor: on ? c.primary : c.borderStrong, backgroundColor: on ? c.primarySoft : c.surface }}>
                      <T variant="smallStrong">{r === 'other' ? 'Another reason…' : r}</T>
                    </Pressable>
                  );
                })}
              </View>
              {pick === 'other' ? <TextField label="Reason" value={other} onChange={setOther} autoFocus maxLength={200} style={{ marginTop: 12 }} /> : null}
              <View style={{ gap: 8, marginTop: 16 }}>
                <Button title="Cancel sale" kind="dangerSolid" icon="xcircle" loading={busy} disabled={!reason || reason.length < 3} onPress={() => onCancel(reason)} />
                <Button title="Keep the sale" kind="ghost" disabled={busy} onPress={close} />
              </View>
            </ScrollView>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
