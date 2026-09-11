import { Platform, Share } from 'react-native';
import * as Sharing from 'expo-sharing';
import { openWhatsAppChat } from './whatsapp';

export interface ShareInvoiceInput {
  /** Local file:// URI of the invoice PDF, already written to disk. */
  fileUri: string;
  /** The shipment message that must reach the customer with the PDF. */
  message: string;
  /** Customer's mobile, used to open the right chat on Android. */
  phone?: string | null;
}

/**
 * Sends the shipment message and the invoice PDF to the customer as one
 * action.
 *
 * This used to call `Linking.openURL('https://wa.me/...')` and then present
 * the PDF share sheet. The deep link backgrounds the app immediately, so the
 * sheet queued up behind it and the PDF was, in practice, never sent — the
 * customer only ever got the text.
 *
 * What each platform can actually do in one share decides the rest:
 *
 * - **iOS** puts both items into a single `UIActivityViewController`, so one
 *   sheet hands WhatsApp the message *and* the file together. That is the
 *   whole flow.
 * - **Android** cannot. React Native's ShareModule hardcodes
 *   `type="text/plain"` and only ever sets `EXTRA_SUBJECT`/`EXTRA_TEXT` — it
 *   drops `url` entirely — and `expo-sharing` sends the file with no way to
 *   attach a caption. So the file goes through the share sheet first, and
 *   only once that sheet has been dismissed (the promise resolves) does the
 *   chat open with the message prefilled. Both arrive; neither is lost to a
 *   backgrounded app.
 */
export const shareInvoiceWithMessage = async ({ fileUri, message, phone }: ShareInvoiceInput): Promise<void> => {
  if (Platform.OS === 'ios') {
    await Share.share({ message, url: fileUri });
    return;
  }

  const canShareFiles = await Sharing.isAvailableAsync();
  if (canShareFiles) {
    await Sharing.shareAsync(fileUri, {
      mimeType: 'application/pdf',
      UTI: 'com.adobe.pdf',
      dialogTitle: 'Send the invoice',
    });
  }
  // Runs after the file sheet closes, so the chat opens on top of a
  // completed share rather than cancelling it.
  openWhatsAppChat(phone, message);
};
