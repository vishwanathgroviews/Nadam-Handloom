import { sharePdf } from './pdf';

export class WhatsAppNotInstalledError extends Error {
  constructor() {
    super('WhatsApp is not installed.');
    this.name = 'WhatsAppNotInstalledError';
  }
}

export const canSendPdfToWhatsAppChat = (): boolean => false;

export const sendPdfToWhatsAppChat = async (
  _fileUri: string,
  _mobile: string,
  _filename: string,
  _caption: string
) => {
  throw new WhatsAppNotInstalledError();
};

export type WhatsAppPdfRoute = 'chat' | 'share_menu' | 'share_menu_no_whatsapp';

export const sharePdfOnWhatsApp = async (
  fileUri: string,
  _mobile: string | null,
  _filename: string,
  _caption: string
): Promise<WhatsAppPdfRoute> => {
  await sharePdf(fileUri);
  return 'share_menu';
};
