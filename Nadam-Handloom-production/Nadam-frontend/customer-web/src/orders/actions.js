// Download invoice and Buy again (W7 7.6 A, 7.7 A) for an order's card and its page, with their
// busy states and messages.
import { useState } from 'react';
import { useToast } from '../components/Toasts.jsx';
import { useConfig } from '../config/useConfig.js';
import { whatsAppLink } from '../bag/message.js';
import { buyAgain as buyAgainIntoBag } from '../bag/store.js';
import { downloadInvoice } from './invoice.js';

// What Buy again says (rule 6): what went in, and what couldn't, by name when it is one saree.
export function buyAgainMessage(r) {
  const into = r.added.length + r.raised.length;
  const sold = r.skipped.filter((x) => x.reason === 'sold_out');
  const gone = r.skipped.filter((x) => x.reason === 'unavailable');
  const full = r.skipped.filter((x) => x.reason === 'bag_full');
  const fewer = r.added.filter((x) => x.fewer).length;
  const bits = [];
  if (into) bits.push(`${into === 1 ? '1 saree' : `${into} sarees`} added to your bag.`);
  else if (r.already.length) bits.push(r.already.length === 1 ? 'This saree is already in your bag.' : 'These sarees are already in your bag.');
  if (fewer) bits.push(fewer === 1 ? 'One has fewer pieces left: added as many as there are.' : `${fewer} have fewer pieces left: added as many as there are.`);
  if (sold.length) bits.push(sold.length === 1 ? `${sold[0].name} has sold since.` : `${sold.length} have sold since.`);
  if (gone.length) bits.push(gone.length === 1 ? `${gone[0].name} is no longer on the website.` : `${gone.length} are no longer on the website.`);
  if (full.length) bits.push(`${full.length === 1 ? '1 didn\'t' : `${full.length} didn't`} fit: your bag is full (20 sarees).`);
  if (!into && !r.already.length) bits.unshift('None of these sarees can be bought now.');
  return { text: bits.join(' '), missing: sold.length + gone.length, ok: into + r.already.length > 0 };
}

// Download invoice and Buy again, with their busy states and messages.
export function useOrderActions(order) {
  const toast = useToast();
  const { config } = useConfig();
  const [busy, setBusy] = useState(null); // 'invoice' | 'buy'
  const ask = whatsAppLink(config.store.whatsapp, `Hello Nandam Handlooms, about my order ${order.number}: some sarees have sold since. Do you have similar ones?`);
  async function invoice() {
    setBusy('invoice');
    try {
      const name = await downloadInvoice(order.number);
      toast(`Invoice ${name.replace(/\.pdf$/, '')} downloaded`);
    } catch (err) {
      toast(err.message, { tone: err.code === 'INVOICE_NOT_READY' ? 'info' : 'bad' });
    } finally {
      setBusy(null);
    }
  }
  async function buy() {
    setBusy('buy');
    try {
      const m = buyAgainMessage(await buyAgainIntoBag(order.number));
      toast(m.text, {
        tone: m.ok ? (m.missing ? 'info' : 'ok') : 'bad', ms: 9000,
        action: m.missing ? { label: 'Ask on WhatsApp', onClick: () => window.open(ask, '_blank', 'noopener') } : undefined,
      });
    } catch (err) {
      toast(err.message, { tone: 'bad' });
    } finally {
      setBusy(null);
    }
  }
  return { busy, invoice, buy };
}
