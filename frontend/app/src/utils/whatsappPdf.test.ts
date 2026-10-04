import { beforeEach, describe, expect, it, vi } from 'vitest';

// The helper only decides which route a PDF takes; the native share modules
// themselves are stubbed (there is no device here to open WhatsApp on).
const platform = vi.hoisted(() => ({ OS: 'android' }));
vi.mock('react-native', () => ({ Platform: platform }));

const isPackageInstalled = vi.fn();
const shareSingle = vi.fn();
vi.mock('react-native-share', () => ({
  default: { isPackageInstalled: (pkg: string) => isPackageInstalled(pkg), shareSingle: (o: unknown) => shareSingle(o) },
  Social: { Whatsapp: 'whatsapp', Whatsappbusiness: 'whatsappbusiness' },
}));

const sharePdf = vi.fn();
vi.mock('./pdf', () => ({ sharePdf: (uri: string) => sharePdf(uri) }));

import { canSendPdfToWhatsAppChat, sharePdfOnWhatsApp } from './whatsappPdf';

const send = (mobile: string | null) => sharePdfOnWhatsApp('file:///invoice.pdf', mobile, 'INV-000001.pdf', 'Your invoice');

beforeEach(() => {
  platform.OS = 'android';
  isPackageInstalled.mockReset();
  shareSingle.mockReset();
  sharePdf.mockReset();
});

describe('sharePdfOnWhatsApp', () => {
  it("opens the customer's chat with the PDF attached on Android", async () => {
    isPackageInstalled.mockImplementation(async (pkg: string) => ({ isInstalled: pkg === 'com.whatsapp' }));

    await expect(send('9876543210')).resolves.toBe('chat');

    expect(shareSingle).toHaveBeenCalledWith(
      expect.objectContaining({
        social: 'whatsapp',
        url: 'file:///invoice.pdf',
        type: 'application/pdf',
        filename: 'INV-000001.pdf',
        message: 'Your invoice',
        whatsAppNumber: '919876543210',
      })
    );
    expect(sharePdf).not.toHaveBeenCalled();
  });

  it('prefers WhatsApp Business when both apps are installed', async () => {
    isPackageInstalled.mockResolvedValue({ isInstalled: true });

    await send('9876543210');

    expect(shareSingle).toHaveBeenCalledWith(expect.objectContaining({ social: 'whatsappbusiness' }));
  });

  it('falls back to the share menu on Android when WhatsApp is not installed', async () => {
    isPackageInstalled.mockResolvedValue({ isInstalled: false });

    await expect(send('9876543210')).resolves.toBe('share_menu_no_whatsapp');

    expect(shareSingle).not.toHaveBeenCalled();
    expect(sharePdf).toHaveBeenCalledWith('file:///invoice.pdf');
  });

  it('uses the share menu on iPhone and never asks which apps are installed', async () => {
    platform.OS = 'ios';
    // The library throws 'Not implemented' for this check on iPhone.
    isPackageInstalled.mockRejectedValue(new Error('Not implemented'));

    expect(canSendPdfToWhatsAppChat()).toBe(false);
    await expect(send('9876543210')).resolves.toBe('share_menu');

    expect(isPackageInstalled).not.toHaveBeenCalled();
    expect(sharePdf).toHaveBeenCalledWith('file:///invoice.pdf');
  });

  it('uses the share menu when there is no number to open a chat for', async () => {
    await expect(send(null)).resolves.toBe('share_menu');

    expect(isPackageInstalled).not.toHaveBeenCalled();
    expect(sharePdf).toHaveBeenCalledWith('file:///invoice.pdf');
  });

  it('passes on a failure that is not about WhatsApp being missing', async () => {
    isPackageInstalled.mockResolvedValue({ isInstalled: true });
    shareSingle.mockRejectedValue(new Error('User did not share'));

    await expect(send('9876543210')).rejects.toThrow('User did not share');
    expect(sharePdf).not.toHaveBeenCalled();
  });
});
