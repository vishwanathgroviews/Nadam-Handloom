import { Platform } from 'react-native';
import Share, { Social, ShareSingleOptions } from 'react-native-share';
import { sharePdf } from './pdf';

/** WhatsApp Business first (the usual app on a shop phone), then regular WhatsApp. */
const APPS = [
  { pkg: 'com.whatsapp.w4b', social: Social.Whatsappbusiness },
  { pkg: 'com.whatsapp', social: Social.Whatsapp },
] as const;

export class WhatsAppNotInstalledError extends Error {
  constructor() {
    super('WhatsApp is not installed on this phone.');
    this.name = 'WhatsAppNotInstalledError';
  }
}

/**
 * Whether this phone can open one customer's WhatsApp chat with a file
 * already attached. Android can. WhatsApp on iPhone gives apps no way to do
 * it — a file can only be handed to the share menu, where staff pick the
 * chat — so screens ask for the customer's number only where this is true.
 */
export const canSendPdfToWhatsAppChat = (): boolean => Platform.OS === 'android';

/**
 * Opens the customer's WhatsApp chat with the PDF already attached, in one
 * tap. Staff then press WhatsApp's own Send — WhatsApp does not let any app
 * send a message by itself. Android only (see canSendPdfToWhatsAppChat).
 *
 * The number goes only to WhatsApp, on this phone. It opens the chat even if
 * the number isn't saved in the phone's contacts.
 *
 * @param fileUri  the PDF saved on the phone (file://…)
 * @param mobile   a cleaned 10-digit Indian mobile (see cleanMobile)
 */
export const sendPdfToWhatsAppChat = async (fileUri: string, mobile: string, filename: string, caption: string) => {
  for (const app of APPS) {
    const { isInstalled } = await Share.isPackageInstalled(app.pkg);
    if (!isInstalled) continue;
    // whatsAppNumber is read by the library's Android code (it opens the chat
    // for that number, creating it if it isn't in contacts) and passed through
    // untouched by its JavaScript, but is missing from its TypeScript types.
    //
    // The library as published then fired a SECOND intent at WhatsApp with no
    // chat attached, which landed on WhatsApp's contact picker and hid the
    // chat it had just opened — staff had to pick the customer by hand. That
    // second intent is now only a fallback: see
    // patches/react-native-share+12.3.1.patch.
    const options: ShareSingleOptions & { whatsAppNumber: string } = {
      social: app.social,
      url: fileUri,
      type: 'application/pdf',
      filename,
      message: caption,
      whatsAppNumber: `91${mobile}`,
    };
    await Share.shareSingle(options);
    return;
  }
  throw new WhatsAppNotInstalledError();
};

/** How a PDF ended up reaching WhatsApp — screens word their hint from it. */
export type WhatsAppPdfRoute = 'chat' | 'share_menu' | 'share_menu_no_whatsapp';

/**
 * Gets a PDF to a customer on WhatsApp the most direct way the phone allows:
 * straight into their chat where that is possible, otherwise through the
 * share menu. `mobile` is only used for the direct route.
 */
export const sharePdfOnWhatsApp = async (
  fileUri: string,
  mobile: string | null,
  filename: string,
  caption: string
): Promise<WhatsAppPdfRoute> => {
  if (!canSendPdfToWhatsAppChat() || !mobile) {
    await sharePdf(fileUri);
    return 'share_menu';
  }
  try {
    await sendPdfToWhatsAppChat(fileUri, mobile, filename, caption);
    return 'chat';
  } catch (err) {
    if (!(err instanceof WhatsAppNotInstalledError)) throw err;
    // No WhatsApp on this phone: still get the PDF out, via the share menu.
    await sharePdf(fileUri);
    return 'share_menu_no_whatsapp';
  }
};
