// The invoice buttons after a sale and on a past sale (5.4): Share on WhatsApp
// (Android: straight into the customer's chat; asks for the number when the sale has
// none, not saved anywhere), Print, Share another way. iPhone: the share menu.
import { useState } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../theme/ThemeProvider';
import { useFeedback } from '../Feedback';
import { Button } from '../Button';
import { MobileField } from '../MobileField';
import { T } from '../T';
import { mobileError, formatMobile } from '../../utils/phone';
import { printInvoice, shareInvoiceAnotherWay, shareInvoiceOnWhatsApp, whatsAppChatAvailable } from '../../utils/invoice';

function AskMobile({ visible, onClose, onSend }) {
  const { c, radius } = useTheme();
  const insets = useSafeAreaInsets();
  const [mobile, setMobile] = useState('');
  const [err, setErr] = useState(null);
  const close = () => { setMobile(''); setErr(null); onClose(); };
  function send() {
    const e = mobileError(mobile);
    if (e) { setErr(e.replace('your', 'the customer\'s')); return; }
    const m = mobile;
    setMobile('');
    onSend(m);
  }
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={close} statusBarTranslucent>
      <KeyboardAvoidingView behavior="padding" style={{ flex: 1 }}>
        <Pressable onPress={close} style={{ flex: 1, backgroundColor: c.overlay, justifyContent: 'flex-end', padding: 12, paddingBottom: Math.max(insets.bottom, 12) }}>
          <Pressable onPress={() => {}} style={{ backgroundColor: c.surface, borderRadius: radius.xl, padding: 20, width: '100%', maxWidth: 460, alignSelf: 'center' }}>
            <T variant="barTitle">Customer&apos;s WhatsApp number</T>
            <T variant="small" color="text2" style={{ marginTop: 4, marginBottom: 12 }}>The invoice opens in their chat. The number isn&apos;t saved anywhere.</T>
            <MobileField value={mobile} onChange={(d) => { setMobile(d); setErr(null); }} error={err} autoFocus onSubmit={send} />
            <Button title="Open WhatsApp" icon="whatsapp" kind="whatsapp" onPress={send} />
            <Button title="Cancel" kind="ghost" onPress={close} style={{ marginTop: 6 }} />
          </Pressable>
        </Pressable>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// whatsapp={false}: a cancelled invoice (Module 6) is printed or kept, not sent to the customer.
export function InvoiceActions({ invoice, mobile, whatsapp = true }) {
  const { showToast } = useFeedback();
  const [busy, setBusy] = useState(null);
  const [asking, setAsking] = useState(false);
  const android = whatsapp && Platform.OS === 'android' && whatsAppChatAvailable();

  async function run(kind, fn) {
    setBusy(kind);
    try {
      await fn();
    } catch (e) {
      showToast(e.code === 'NOT_AVAILABLE' ? 'WhatsApp isn\'t on this phone. Use "Share another way".' : e.message || 'Couldn\'t open it. Try again.');
    } finally {
      setBusy(null);
    }
  }
  const toChat = (m) => run('wa', () => shareInvoiceOnWhatsApp(invoice, m));
  const another = () => run('other', () => shareInvoiceAnotherWay(invoice));
  const print = () => run('print', () => printInvoice(invoice));

  return (
    <View style={{ gap: 10 }}>
      {android ? (
        <Button title={`Share on WhatsApp${mobile ? ` · +91 ${formatMobile(mobile)}` : ''}`} icon="whatsapp" kind="whatsapp" loading={busy === 'wa'} disabled={!!busy}
          onPress={() => (mobile ? toChat(mobile) : setAsking(true))} />
      ) : whatsapp ? (
        <Button title="Share invoice" icon="share" kind="whatsapp" loading={busy === 'other'} disabled={!!busy} onPress={another} />
      ) : null}
      <View style={{ flexDirection: 'row', gap: 10 }}>
        <Button title="Print" icon="print" kind="secondary" loading={busy === 'print'} disabled={!!busy} onPress={print} style={{ flex: 1 }} />
        {android || !whatsapp ? <Button title={whatsapp ? 'Share another way' : 'Share'} icon="share" kind="secondary" loading={busy === 'other'} disabled={!!busy} onPress={another} style={{ flex: 1.4 }} /> : null}
      </View>
      <AskMobile visible={asking} onClose={() => setAsking(false)} onSend={(m) => { setAsking(false); setTimeout(() => toChat(m), 250); }} />
    </View>
  );
}
