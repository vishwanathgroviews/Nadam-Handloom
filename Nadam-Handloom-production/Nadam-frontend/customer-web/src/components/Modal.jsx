import { createContext, useCallback, useContext, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import Button from './Button.jsx';
import Icon from './Icon.jsx';

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

// A dialog: focus moves in and stays in, Escape or the backdrop closes it (unless busy),
// focus returns to where it was, and the page behind doesn't scroll.
export default function Modal({ title, onClose, children, wide, busy = false, labelledBy, describedBy, className = '', role = 'dialog' }) {
  const box = useRef(null);
  const closeRef = useRef(onClose);
  const busyRef = useRef(busy);
  useLayoutEffect(() => {
    closeRef.current = onClose;
    busyRef.current = busy;
  });

  useEffect(() => {
    const before = document.activeElement;
    const el = box.current;
    const first = el?.querySelector('[autofocus], input, select, textarea') || el?.querySelector(FOCUSABLE) || el;
    first?.focus({ preventScroll: true });
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    function onKey(e) {
      if (e.key === 'Escape' && !busyRef.current) { e.stopPropagation(); closeRef.current?.(); }
      if (e.key === 'Tab' && el) {
        const items = [...el.querySelectorAll(FOCUSABLE)].filter((n) => n.offsetParent !== null || n === document.activeElement);
        if (!items.length) { e.preventDefault(); el.focus(); return; } // nothing to press: stay here
        const [a, z] = [items[0], items[items.length - 1]];
        if (e.shiftKey && document.activeElement === a) { e.preventDefault(); z.focus(); }
        else if (!e.shiftKey && document.activeElement === z) { e.preventDefault(); a.focus(); }
      }
    }
    document.addEventListener('keydown', onKey, true);
    return () => {
      document.removeEventListener('keydown', onKey, true);
      document.body.style.overflow = prevOverflow;
      if (before && before.focus) before.focus({ preventScroll: true });
    };
  }, []);

  return createPortal(
    <>
      <div className="scrim" onClick={() => !busy && onClose?.()} aria-hidden="true" />
      <div className="modal">
        <div ref={box} className={`modal-box${wide ? ' wide' : ''}${className ? ` ${className}` : ''}`} role={role} aria-modal="true" aria-labelledby={labelledBy} aria-describedby={describedBy} aria-label={labelledBy ? undefined : title} tabIndex={-1}>
          {children}
        </div>
      </div>
    </>,
    document.body,
  );
}

/* ---------- "Are you sure?" ---------- */
const ConfirmCtx = createContext(async () => false);

export function ConfirmProvider({ children }) {
  const [ask, setAsk] = useState(null);
  const confirm = useCallback((opts) => new Promise((resolve) => setAsk({ ...opts, resolve })), []);
  const answer = (v) => { ask?.resolve(v); setAsk(null); };
  return (
    <ConfirmCtx.Provider value={confirm}>
      {children}
      {ask ? (
        <Modal title={ask.title} onClose={() => answer(false)} labelledBy="confirm-title">
          <div className="head">
            <span className={`tone ${ask.tone || ''}`}><Icon name={ask.icon || 'info'} /></span>
            <div style={{ display: 'grid', gap: '.35rem' }}>
              <h3 id="confirm-title">{ask.title}</h3>
              {ask.text ? <p className="muted">{ask.text}</p> : null}
            </div>
          </div>
          <div className="acts">
            <Button onClick={() => answer(false)}>{ask.cancel || 'Cancel'}</Button>
            <Button kind={ask.danger ? 'danger' : 'primary'} onClick={() => answer(true)}>{ask.ok || 'OK'}</Button>
          </div>
        </Modal>
      ) : null}
    </ConfirmCtx.Provider>
  );
}

export const useConfirm = () => useContext(ConfirmCtx);
