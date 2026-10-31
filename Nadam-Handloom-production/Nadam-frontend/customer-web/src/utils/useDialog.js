import { useEffect, useLayoutEffect, useRef } from 'react';

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

// For a drawer or full-screen view: focus moves in and stays in, Escape closes it, the page
// behind doesn't scroll, and focus goes back to where it was. onKey gets other keys (arrows).
export function useDialog(ref, onClose, { onKey } = {}) {
  const handlers = useRef({ onClose, onKey });
  useLayoutEffect(() => { handlers.current = { onClose, onKey }; });
  useEffect(() => {
    const before = document.activeElement;
    const el = ref.current;
    (el?.querySelector('[data-autofocus]') || el?.querySelector(FOCUSABLE) || el)?.focus({ preventScroll: true });
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const key = (e) => {
      if (e.key === 'Escape') { e.stopPropagation(); handlers.current.onClose(); return; }
      if (e.key === 'Tab' && el) {
        const items = [...el.querySelectorAll(FOCUSABLE)].filter((n) => n.offsetParent !== null);
        if (!items.length) { e.preventDefault(); return; }
        const [a, z] = [items[0], items[items.length - 1]];
        if (e.shiftKey && document.activeElement === a) { e.preventDefault(); z.focus(); }
        else if (!e.shiftKey && document.activeElement === z) { e.preventDefault(); a.focus(); }
        return;
      }
      handlers.current.onKey?.(e);
    };
    document.addEventListener('keydown', key, true);
    return () => {
      document.removeEventListener('keydown', key, true);
      document.body.style.overflow = prev;
      before?.focus?.({ preventScroll: true });
    };
  }, [ref]);
}
