const INR = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  maximumFractionDigits: 0,
});

export const formatPrice = (value) => INR.format(Number(value) || 0);

export const discountPercent = (mrp, price) => {
  const m = Number(mrp);
  const p = Number(price);
  if (!m || m <= p) return 0;
  return Math.round(((m - p) / m) * 100);
};
