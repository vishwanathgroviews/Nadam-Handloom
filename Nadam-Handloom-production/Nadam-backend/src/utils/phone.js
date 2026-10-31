// Indian mobile numbers: stored as 10 digits starting 6-9 (the live database's format).
export function normalizeMobile(input) {
  let digits = String(input ?? '').replace(/\D/g, '');
  if (digits.length === 12 && digits.startsWith('91')) digits = digits.slice(2);
  if (digits.length === 11 && digits.startsWith('0')) digits = digits.slice(1);
  return /^[6-9]\d{9}$/.test(digits) ? digits : null;
}

// "+91 98765 •••10" for screens that should not show the full number.
export const maskMobile = (m) => (m && m.length === 10 ? `+91 ${m.slice(0, 5)} •••${m.slice(8)}` : '');
