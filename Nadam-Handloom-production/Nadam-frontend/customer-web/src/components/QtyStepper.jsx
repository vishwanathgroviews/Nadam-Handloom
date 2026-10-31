import Icon from './Icon.jsx';

// How many pieces of a set (5.4 A): − 1 +. Never below 1 or above `max`.
export default function QtyStepper({ value, max, onChange, label, small = false, disabled = false }) {
  return (
    <div className={`qty${small ? ' sm' : ''}`} role="group" aria-label={label}>
      <button type="button" onClick={() => onChange(value - 1)} disabled={disabled || value <= 1} aria-label="One piece fewer">
        <Icon name="minus" size="sm" />
      </button>
      <output aria-live="polite">{value}</output>
      <button type="button" onClick={() => onChange(value + 1)} disabled={disabled || value >= max} aria-label="One piece more">
        <Icon name="plus" size="sm" />
      </button>
    </div>
  );
}
