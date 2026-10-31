import { useEffect, useId, useLayoutEffect, useRef } from 'react';
import Icon from './Icon.jsx';

const LEN = 6;

// Six boxes for the SMS code. Typing moves on, Backspace moves back, a pasted or
// auto-filled code fills every box. On Android Chrome the code fills itself in from the SMS
// (Web OTP); iPhones offer it above the keyboard (autocomplete="one-time-code").
// value: the digits so far (string). onComplete runs when all six are in.
export default function CodeInput({ value, onChange, onComplete, error, disabled, shakeKey, label = '6-digit code', autoFocus = true }) {
  const id = useId();
  const refs = useRef([]);
  const rowRef = useRef(null);
  const digits = Array.from({ length: LEN }, (_, i) => value[i] || '');

  // Wrong code: shake and start again from the first box.
  useEffect(() => {
    if (!shakeKey) return;
    const row = rowRef.current;
    row?.classList.remove('shake');
    void row?.offsetWidth;
    row?.classList.add('shake');
    refs.current[0]?.focus();
  }, [shakeKey]);

  // Focus the first empty box as soon as the boxes appear (no delay: a delayed focus
  // would pull the cursor back while someone is already typing).
  useLayoutEffect(() => {
    if (autoFocus) refs.current[Math.min(value.length, LEN - 1)]?.focus({ preventScroll: true });
    // Only when the boxes first appear.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Web OTP (Android Chrome): reads the code from the SMS when its last line is "@<site> #<code>".
  useEffect(() => {
    if (disabled || typeof window === 'undefined' || !('OTPCredential' in window)) return undefined;
    const ac = new AbortController();
    navigator.credentials.get({ otp: { transport: ['sms'] }, signal: ac.signal })
      .then((otp) => {
        const code = String(otp?.code || '').replace(/\D/g, '').slice(0, LEN);
        if (code.length === LEN) { onChange(code); onComplete?.(code); }
      })
      .catch(() => {});
    return () => ac.abort();
    // Once per code screen.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [disabled]);

  function setFrom(index, raw) {
    const incoming = raw.replace(/\D/g, '');
    if (!incoming) return;
    const next = (value.slice(0, index) + incoming).slice(0, LEN);
    onChange(next);
    if (next.length === LEN) {
      refs.current[LEN - 1]?.blur();
      onComplete?.(next);
    } else refs.current[Math.min(next.length, LEN - 1)]?.focus();
  }

  function onKeyDown(i, e) {
    if (e.key === 'Backspace') {
      e.preventDefault();
      if (digits[i]) onChange(value.slice(0, i));
      else if (i > 0) { onChange(value.slice(0, i - 1)); refs.current[i - 1]?.focus(); }
    } else if (e.key === 'ArrowLeft' && i > 0) { e.preventDefault(); refs.current[i - 1]?.focus(); }
    else if (e.key === 'ArrowRight' && i < LEN - 1 && digits[i]) { e.preventDefault(); refs.current[i + 1]?.focus(); }
  }

  const errId = error ? `${id}-err` : undefined;
  return (
    <div className={`field${error ? ' has-error' : ''}`}>
      <span className="label" id={`${id}-l`}>{label}</span>
      <div className="otp-row" role="group" aria-labelledby={`${id}-l`} aria-describedby={errId} ref={rowRef}>
        {digits.map((d, i) => (
          <input
            // Fixed number of boxes: the index is the identity.
            key={i}
            ref={(el) => { refs.current[i] = el; }}
            className="input"
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            autoComplete={i === 0 ? 'one-time-code' : 'off'}
            maxLength={i === 0 ? LEN : 1}
            aria-label={`Digit ${i + 1} of ${LEN}`}
            aria-invalid={error ? 'true' : undefined}
            value={d}
            disabled={disabled}
            onFocus={(e) => e.target.select()}
            onKeyDown={(e) => onKeyDown(i, e)}
            onPaste={(e) => { e.preventDefault(); setFrom(i, e.clipboardData.getData('text')); }}
            onChange={(e) => {
              const v = e.target.value;
              if (v.length > 1) setFrom(i, v); // auto-fill puts the whole code in one box
              else if (/\d/.test(v)) setFrom(i, v);
            }}
          />
        ))}
      </div>
      {error ? <p className="field-error" id={errId} role="alert"><Icon name="alertc" size="sm" />{error}</p> : null}
    </div>
  );
}
