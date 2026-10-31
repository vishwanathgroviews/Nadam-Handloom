// The invoice endpoints (Module 6). The sales summary's PDF and Excel file are
// owners-only, so they are fetched with the sign-in key and saved on the phone
// before sharing (never left on a public link).
import { Directory, File, Paths } from 'expo-file-system';
import { api } from './client';

const qs = (o) => Object.entries(o).filter(([, v]) => v !== undefined && v !== null && v !== '' && v !== false).map(([k, v]) => `${k}=${encodeURIComponent(v)}`).join('&');

// { invoices, nextOffset, scope, totals (owners) }
export const listInvoices = ({ q = '', from, to, channel = 'all', cancelled = false, offset = 0 }) =>
  api(`/invoices?${qs({ q: q.trim(), from: q.trim() ? undefined : from, to: q.trim() ? undefined : to, channel, cancelled, offset })}`);
export const getInvoice = (id) => api(`/invoices/${id}`);
export const correctCustomer = (id, { name, mobile }) => api(`/invoices/${id}/customer`, { method: 'PATCH', body: { ...(name ? { name } : {}), ...(mobile ? { mobile } : {}) } });
// 20 at a time (offset, then nextOffset); totals cover the whole period.
export const salesWithout = ({ from, to, channel = 'all', offset = 0 }) => api(`/invoices/without?${qs({ from, to, channel, offset })}`);
export const makeSummary = ({ from, to, channels }) => api('/invoices/summary', { method: 'POST', body: { from, to, channels } });
export const makeInvoiceLater = (saleId) => api(`/sales/${saleId}/make-invoice`, { method: 'POST' });

// kind: 'pdf' | 'csv'. Returns the file's address on the phone.
export async function summaryFile(kind, { from, to, channels }, fileName) {
  const bytes = await api(`/invoices/summary/${kind}?${qs({ from, to, channels: channels.join(',') })}`, { bytes: true, timeoutMs: 60000 });
  const dir = new Directory(Paths.cache, 'summaries');
  if (!dir.exists) dir.create();
  const file = new File(dir, fileName);
  if (file.exists) file.delete();
  file.create();
  file.write(bytes);
  return file.uri;
}
