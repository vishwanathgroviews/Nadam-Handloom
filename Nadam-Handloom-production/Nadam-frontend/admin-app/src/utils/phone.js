// Indian mobile numbers: 10 digits starting 6-9 (the server's format).
export const digitsOnly = (s) => String(s ?? '').replace(/\D/g, '');

export function normalizeMobile(input) {
  let d = digitsOnly(input);
  if (d.length === 12 && d.startsWith('91')) d = d.slice(2);
  if (d.length === 11 && d.startsWith('0')) d = d.slice(1);
  return /^[6-9]\d{9}$/.test(d) ? d : null;
}

// "98765 43210" while typing.
export const formatMobile = (d) => (d.length > 5 ? `${d.slice(0, 5)} ${d.slice(5, 10)}` : d);

export function mobileError(d) {
  if (!d) return 'Enter your 10-digit mobile number.';
  if (d.length !== 10) return 'Enter a 10-digit mobile number.';
  if (!/^[6-9]/.test(d)) return 'Mobile numbers start with 6, 7, 8 or 9.';
  return null;
}

export const maskMobile = (m) => (m && m.length === 10 ? `+91 ${m.slice(0, 5)} •••${m.slice(8)}` : '');
