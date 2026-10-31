// Sends a file to a customer. Android: straight into their WhatsApp chat (our own
// native code), or the share menu. iPhone: the share menu with the caption (Apple
// doesn't allow opening a chat with a file attached). Docs: Module 3, plan 5.10.
import { Platform, Share } from 'react-native';
import { requireOptionalNativeModule } from 'expo';

const Native = Platform.OS === 'android' ? requireOptionalNativeModule('NandamShare') : null;

export const canSendToWhatsAppChat = () => !!Native && !!Native.whatsAppPackage();

export async function sendToWhatsApp({ uri, mimeType, mobile, caption }) {
  if (!Native) throw Object.assign(new Error('Not available on this phone.'), { code: 'NOT_AVAILABLE' });
  return Native.shareToWhatsApp(uri, mimeType, mobile, caption);
}

export async function shareFile({ uri, mimeType, caption, title }) {
  if (Native) return Native.shareFile(uri, mimeType, caption, title);
  return Share.share({ url: uri, message: caption, title }); // iOS: file plus caption
}
