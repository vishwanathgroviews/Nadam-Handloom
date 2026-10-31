import Field from './Field.jsx';

// "+91" and a 10-digit mobile number. Accepts pasted numbers with +91, spaces or a leading 0.
export default function MobileInput({ label = 'Mobile number', value, onChange, error, hint, autoFocus, disabled, inputRef, action }) {
  return (
    <Field label={label} error={error} hint={hint}>
      {(p) => (
        <div className="input-group">
          <span className="pre" aria-hidden="true">+91</span>
          <input
            {...p}
            ref={inputRef}
            className="input"
            type="tel"
            inputMode="numeric"
            autoComplete="tel-national"
            placeholder="10-digit mobile number"
            maxLength={16}
            value={value}
            disabled={disabled}
            autoFocus={autoFocus}
            onChange={(e) => onChange(e.target.value.replace(/[^\d+ -]/g, ''))}
          />
          {action}
        </div>
      )}
    </Field>
  );
}
