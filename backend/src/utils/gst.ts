// All product prices in this system are GST-inclusive. Given an inclusive
// amount and a flat rate, this extracts the pre-tax (taxable) value and
// splits the tax evenly into CGST + SGST (this business only sells
// intra-state, so IGST never applies).
//
// gstAmount is derived as inclusiveAmount - taxableValue (not
// inclusiveAmount * r/(100+r) rounded independently) so taxableValue +
// cgst + sgst always reconciles exactly back to inclusiveAmount — any
// rounding remainder is absorbed into sgst rather than left as drift.

export interface GstSplit {
  taxableValue: number;
  gstAmount: number;
  cgst: number;
  sgst: number;
}

const round2 = (value: number): number => Math.round(value * 100) / 100;

export const splitGst = (inclusiveAmount: number, ratePercent: number): GstSplit => {
  const taxableValue = round2(inclusiveAmount / (1 + ratePercent / 100));
  const gstAmount = round2(inclusiveAmount - taxableValue);
  const cgst = round2(gstAmount / 2);
  const sgst = round2(gstAmount - cgst);
  return { taxableValue, gstAmount, cgst, sgst };
};
