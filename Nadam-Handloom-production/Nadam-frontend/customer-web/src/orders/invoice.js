// The invoice download (W7 7.6 A): fetched from our server with the customer's sign-in, then
// saved by the browser under its own number (INV-000123.pdf). There is no public link.
import { shopApi } from '../api/shop.js';

export async function downloadInvoice(number) {
  const { blob, filename } = await shopApi.invoice(number);
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.rel = 'noopener';
  document.body.appendChild(a);
  a.click();
  a.remove();
  // Some browsers start the download after this tick: the address lives a little longer.
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
  return filename;
}
