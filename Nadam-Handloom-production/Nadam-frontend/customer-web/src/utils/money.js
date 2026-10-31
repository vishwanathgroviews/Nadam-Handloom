const INR = new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 });
export const rs = (v) => `₹${INR.format(Math.round(Number(v) || 0))}`;
export const num = (v) => INR.format(Number(v) || 0);
export const pieces = (n) => `${num(n)} ${n === 1 ? 'piece' : 'pieces'}`;
