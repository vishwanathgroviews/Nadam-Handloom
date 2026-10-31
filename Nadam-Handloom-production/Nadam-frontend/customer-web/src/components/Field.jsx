import { useId } from 'react';
import Icon from './Icon.jsx';

// A labelled form field with its hint and error, wired for screen readers.
// children: (props) => <input {...props} />; props carry id, aria-invalid, aria-describedby.
export default function Field({ id: givenId, label, optional, hint, hintTone, error, children, className = '' }) {
  const autoId = useId();
  const id = givenId || autoId;
  const hintId = hint ? `${id}-hint` : undefined;
  const errId = error ? `${id}-err` : undefined;
  const describedBy = [errId, hintId].filter(Boolean).join(' ') || undefined;
  return (
    <div className={['field', error ? 'has-error' : '', className].filter(Boolean).join(' ')}>
      {label ? (
        <label htmlFor={id}>
          {label} {optional ? <span className="muted">(optional)</span> : null}
        </label>
      ) : null}
      {children({ id, 'aria-invalid': error ? 'true' : undefined, 'aria-describedby': describedBy })}
      {error ? (
        <p className="field-error" id={errId} role="alert">
          <Icon name="alertc" size="sm" />
          {error}
        </p>
      ) : null}
      {hint ? (
        <p className={['field-hint', hintTone || ''].filter(Boolean).join(' ')} id={hintId} aria-live="polite">
          {hint}
        </p>
      ) : null}
    </div>
  );
}
