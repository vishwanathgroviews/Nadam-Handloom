import Share, { Social, ShareSingleOptions } from 'react-native-share';

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
 * Opens the customer's WhatsApp chat with the invoice PDF already attached,
 * in one tap. Staff then press WhatsApp's own Send — WhatsApp does not let
 * any app send a message by itself.
 *
 * The number goes only to WhatsApp, on this phone. It opens the chat even if
 * the number isn't saved in the phone's contacts.
 *
 * @param fileUri  the invoice PDF saved on the phone (file://…)
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
