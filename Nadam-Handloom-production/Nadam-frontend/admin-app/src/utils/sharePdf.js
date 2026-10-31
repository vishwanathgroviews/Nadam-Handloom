// Gets a PDF (a catalogue, or a customer's invoice in Module 5) onto the phone and
// sends it (decision 5.10): Android straight into the customer's WhatsApp chat;
// iPhone and "another way" through the share menu. doc: { url, fileName, caption }.
import { Directory, File, Paths } from 'expo-file-system';
import { sendToWhatsApp, shareFile, canSendToWhatsAppChat } from '../../modules/nandam-share';

// idempotent: a newer copy (e.g. an invoice stamped CANCELLED) replaces the old one.
export async function downloadPdf(doc, folder = 'catalogues') {
  const dir = new Directory(Paths.cache, folder);
  if (!dir.exists) dir.create();
  const file = new File(dir, doc.fileName);
  const saved = await File.downloadFileAsync(doc.url, file, { idempotent: true });
  return saved.uri;
}

export const whatsAppChatAvailable = () => canSendToWhatsAppChat();

export async function sharePdfOnWhatsApp(doc, mobile, folder) {
  const uri = await downloadPdf(doc, folder);
  return sendToWhatsApp({ uri, mimeType: 'application/pdf', mobile, caption: doc.caption });
}

export async function sharePdfAnotherWay(doc, { folder, title = 'Send the catalogue' } = {}) {
  const uri = await downloadPdf(doc, folder);
  return shareFile({ uri, mimeType: 'application/pdf', caption: doc.caption, title });
}
