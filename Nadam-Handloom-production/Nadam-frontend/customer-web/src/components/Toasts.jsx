import { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';
import Icon from './Icon.jsx';

const Ctx = createContext(() => {});

// Short messages at the bottom ("Profile saved"). They go by themselves; errors stay longer.
// action: { label, onClick } adds a button ("Undo", "View bag"); pressing it closes the message.
export function ToastProvider({ children }) {
  const [list, setList] = useState([]);
  const seq = useRef(0);
  const dismiss = useCallback((id) => setList((l) => l.filter((t) => t.id !== id)), []);
  const toast = useCallback((text, { tone = 'ok', ms, action } = {}) => {
    const id = ++seq.current;
    setList((l) => [...l.slice(-2), { id, text, tone, action }]);
    setTimeout(() => dismiss(id), ms || (action ? 6000 : tone === 'bad' ? 7000 : 4000));
  }, [dismiss]);
  const value = useMemo(() => toast, [toast]);
  return (
    <Ctx.Provider value={value}>
      {children}
      <div className="toasts" aria-live="polite" aria-atomic="false">
        {list.map((t) => (
          <div key={t.id} className={`toast ${t.tone}`} role={t.tone === 'bad' ? 'alert' : 'status'}>
            <Icon name={t.tone === 'bad' ? 'alertc' : t.tone === 'info' ? 'info' : 'check'} />
            <span>{t.text}</span>
            {t.action ? <button type="button" className="act" onClick={() => { dismiss(t.id); t.action.onClick(); }}>{t.action.label}</button> : null}
            <button type="button" onClick={() => dismiss(t.id)} aria-label="Close message">
              <Icon name="x" size="sm" />
            </button>
          </div>
        ))}
      </div>
    </Ctx.Provider>
  );
}

export const useToast = () => useContext(Ctx);
