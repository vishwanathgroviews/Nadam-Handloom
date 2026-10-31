// A customer's invoice (Module 5, section 5.4): share on WhatsApp (Android: straight
// into the customer's chat), share another way, or print. invoice: the sale's
// { url, fileName, caption } from the server.
import * as Print from 'expo-print';
import { downloadPdf, sharePdfAnotherWay, sharePdfOnWhatsApp, whatsAppChatAvailable } from './sharePdf';

const FOLDER = 'invoices';
export { whatsAppChatAvailable };
export const shareInvoiceOnWhatsApp = (invoice, mobile) => sharePdfOnWhatsApp(invoice, mobile, FOLDER);
export const shareInvoiceAnotherWay = (invoice) => sharePdfAnotherWay(invoice, { folder: FOLDER, title: 'Send the invoice' });
// The phone's own print screen, which also shows the pages first.
export async function printInvoice(invoice) {
  const uri = await downloadPdf(invoice, FOLDER);
  return Print.printAsync({ uri });
}
