// Every price includes GST. Same sums as the old backend's utils/gst.ts, so old and
// new invoices agree to the paisa: taxable value = price ÷ (1 + rate), GST = the rest,
// CGST = half of it, SGST = what is left (any rounding paisa goes to SGST).
export const round2 = (n) => Math.round(n * 100) / 100;

export function splitGst(inclusive, ratePercent) {
  const taxableValue = round2(inclusive / (1 + ratePercent / 100));
  const gstAmount = round2(inclusive - taxableValue);
  const cgst = round2(gstAmount / 2);
  const sgst = round2(gstAmount - cgst);
  return { taxableValue, gstAmount, cgst, sgst };
}

// A whole bill: each line split on its own, then added up (as the old invoices do).
export function billGst(amounts, ratePercent) {
  const paise = { taxableValue: 0, gstAmount: 0, cgst: 0, sgst: 0 };
  for (const a of amounts) {
    const s = splitGst(a, ratePercent);
    for (const k of Object.keys(paise)) paise[k] += Math.round(s[k] * 100);
  }
  return Object.fromEntries(Object.entries(paise).map(([k, v]) => [k, v / 100]));
}

// Money in whole paise, so adding up many lines never drifts.
export const sumMoney = (amounts) => amounts.reduce((t, a) => t + Math.round(Number(a) * 100), 0) / 100;
