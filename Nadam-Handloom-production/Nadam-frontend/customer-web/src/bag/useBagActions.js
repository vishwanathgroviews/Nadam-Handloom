// Changing the bag from a page or the side panel: one change at a time, a message when the
// server refuses (sold out, bag full, offline), and "Removed · Undo".
import { useState } from 'react';
import { useToast } from '../components/Toasts.jsx';
import { remove, setQuantity, undo } from './store.js';

export function useBagActions() {
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const run = async (fn) => {
    setBusy(true);
    try {
      await fn();
    } catch (err) {
      toast(err.message, { tone: 'bad' });
    } finally {
      setBusy(false);
    }
  };
  return {
    busy,
    quantity: (slug, q) => run(() => setQuantity(slug, q)),
    // from: the Remove button pressed. The focus moves to the next saree's Remove (or the one
    // before, or the bag's heading) so a keyboard or screen reader isn't sent back to the top.
    remove: (line, from) => run(async () => {
      const item = from?.closest('article');
      const next = item?.nextElementSibling?.querySelector('.rm') || item?.previousElementSibling?.querySelector('.rm')
        || item?.closest('[role="dialog"], main')?.querySelector('h1, h2');
      await remove(line.slug);
      toast(`Removed ${line.name}`, { action: { label: 'Undo', onClick: () => undo().catch((err) => toast(err.message, { tone: 'bad' })) } });
      requestAnimationFrame(() => {
        if (!next?.isConnected) return;
        if (!next.matches('button') && !next.hasAttribute('tabindex')) next.setAttribute('tabindex', '-1');
        next.focus({ preventScroll: false });
      });
    }),
  };
}
