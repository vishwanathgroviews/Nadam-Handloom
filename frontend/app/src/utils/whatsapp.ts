import { Linking } from 'react-native';

// wa.me needs the full international number (country code, no '+' or
// leading '0') — Indian mobile numbers are stored/entered as a bare
// 10-digit number everywhere else in this app, so assume country code 91
// unless one's already present.
const normalizePhone = (raw: string): string => {
  const digits = raw.replace(/\D/g, '');
  if (digits.length === 10) return `91${digits}`;
  return digits;
};

// Opens a WhatsApp chat pre-filled with `message`. With a known phone
// number it opens that chat directly; without one (e.g. an anonymous
// in-store scan) it opens WhatsApp's own contact picker instead so staff can
// choose who to send it to.
export const openWhatsAppChat = (phone: string | null | undefined, message: string) => {
  const text = encodeURIComponent(message);
  const url = phone ? `https://wa.me/${normalizePhone(phone)}?text=${text}` : `https://wa.me/?text=${text}`;
  Linking.openURL(url).catch(() => {});
};
