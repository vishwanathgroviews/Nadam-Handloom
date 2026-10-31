// The same PIN rules the server enforces (Nadam-backend/src/utils/pin.js), shown live while typing.
export const PIN_LENGTH = 6;

export function pinRules(pin, mobile, { differentFrom } = {}) {
  const full = pin.length === PIN_LENGTH;
  const rules = [
    { key: 'length', label: 'Exactly 6 digits', ok: full ? true : null },
    { key: 'all_same', label: 'Not the same digit repeated (like 111111)', ok: full ? !/^(\d)\1+$/.test(pin) : null },
    { key: 'sequence', label: 'Not a straight run (like 123456 or 654321)', ok: full ? !('0123456789'.includes(pin) || '9876543210'.includes(pin)) : null },
    { key: 'mobile_tail', label: 'Not the last 6 digits of your mobile number', ok: full ? !(mobile && String(mobile).slice(-6) === pin) : null },
  ];
  if (differentFrom !== undefined) rules.push({ key: 'same_as_current', label: 'Different from your current PIN', ok: full ? pin !== differentFrom : null });
  return rules;
}

export const pinAllowed = (pin, mobile, opts) => pinRules(pin, mobile, opts).every((r) => r.ok === true);
