// Cancel an order not yet shipped (owners, the same month, decision 6.3): a reason;
// for an online order, a reminder that the refund is done in Razorpay.
import { useState } from 'react';
import { KeyboardAvoidingView, Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../theme/ThemeProvider';
import { Banner } from '../Banner';
import { Button } from '../Button';
import { TextField } from '../TextField';
import { T } from '../T';
import { rupees } from '../../utils/catalog';
import { CANCEL_REASONS } from '../../utils/orders';

export function CancelOrderModal({ visible, order, busy, onClose, onCancel }) {
  const { c, radius } = useTheme();
  const insets = useSafeAreaInsets();
  const [pick, setPick] = useState(null);
  const [other, setOther] = useState('');
  const reason = pick === 'other' ? other.trim() : pick;
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={busy ? undefined : onClose} statusBarTranslucent>
      <KeyboardAvoidingView behavior="padding" style={{ flex: 1 }}>
        <View style={{ flex: 1, backgroundColor: c.overlay, justifyContent: 'flex-end', padding: 12, paddingBottom: Math.max(insets.bottom, 12) }}>
          {/* The dark background closes the sheet; it sits behind the sheet, so drags inside the sheet always scroll it. */}
          <Pressable accessibilityLabel="Close" onPress={busy ? undefined : onClose} style={StyleSheet.absoluteFill} />
          <View style={{ backgroundColor: c.surface, borderRadius: radius.xl, padding: 20, width: '100%', maxWidth: 460, alignSelf: 'center', maxHeight: '92%' }}>
            <ScrollView keyboardShouldPersistTaps="handled">
              <T variant="barTitle">Cancel {order.orderNumber}?</T>
              <T variant="small" color="text2" style={{ marginTop: 6, marginBottom: 10 }}>
                {order.sarees} saree{order.sarees === 1 ? ' goes' : 's go'} back in stock{order.invoice ? ` and ${order.invoice.number} is marked CANCELLED (kept, never deleted)` : ''}.
              </T>
              {order.channel === 'online' ? <Banner tone="warning" icon="card" title={`Refund ${rupees(order.total)} in Razorpay`} text="The app never moves money. Refund the customer from the Razorpay dashboard." style={{ marginBottom: 10 }} /> : null}
              <View style={{ gap: 8 }}>
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
                <Button title="Cancel order" kind="dangerSolid" icon="xcircle" loading={busy} disabled={!reason || reason.length < 3} onPress={() => onCancel(reason)} />
                <Button title="Keep the order" kind="ghost" disabled={busy} onPress={onClose} />
              </View>
            </ScrollView>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
