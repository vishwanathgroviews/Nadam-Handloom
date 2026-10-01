import { Linking } from 'react-native';

export class WhatsAppNotInstalledError extends Error {
  constructor() {
    super('WhatsApp is not available.');
    this.name = 'WhatsAppNotInstalledError';
  }
}

/**
 * Web fallback for sending PDF / message to WhatsApp.
 * Opens WhatsApp Web chat with pre-filled message and recipient.
 */
export const sendPdfToWhatsAppChat = async (
  _fileUri: string,
  mobile: string,
  _filename: string,
  caption: string
) => {
  const text = encodeURIComponent(caption);
  const cleanDigits = mobile.replace(/\D/g, '');
  const phone = cleanDigits.length === 10 ? `91${cleanDigits}` : cleanDigits;
  const url = `https://wa.me/${phone}?text=${text}`;
  await Linking.openURL(url).catch(() => {
    throw new WhatsAppNotInstalledError();
  });
};
