import { useEffect, useRef, useState } from 'react';
import Field from './Field.jsx';
import Icon from './Icon.jsx';
import { shopApi } from '../api/shop.js';
import { useConfig } from '../config/useConfig.js';
import { isPincode } from '../utils/validate.js';

// Pincode, then city and state filled in from India Post's list. The customer can correct
// the city and state, and types them for a pincode that isn't in the list.
// value: { pincode, city, state }; onChange(patch); errors: { pincode, city, state }.
export default function PlaceFields({ value, onChange, errors = {}, idPrefix = 'place' }) {
  const { config } = useConfig();
  // The last lookup's answer, for one pincode: { pin, state: ok | warn, text }.
  const [look, setLook] = useState({ pin: '', state: 'idle', text: '' });
  const first = useRef(value.pincode);
  const latest = useRef({ value, onChange });
  useEffect(() => { latest.current = { value, onChange }; });

  useEffect(() => {
    const pin = value.pincode;
    if (!isPincode(pin)) return undefined;
    // A saved pincode keeps the customer's city; a newly typed one brings its own.
    const typed = pin !== first.current;
    first.current = null;
    const ac = new AbortController();
    shopApi.pincode(pin, { signal: ac.signal })
      .then((p) => {
        setLook({ pin, state: 'ok', text: `${p.area}, ${p.city}` });
        const v = latest.current.value;
        if (typed || !v.city || !v.state) latest.current.onChange({ city: p.city, state: p.state });
      })
      .catch((err) => {
        if (ac.signal.aborted) return;
        setLook({
          pin,
          state: 'warn',
          text: err.code === 'PINCODE_NOT_FOUND' ? 'We couldn\'t find this pincode. Check it, or type your city and state.' : 'Couldn\'t check the pincode right now. Type your city and state.',
        });
      });
    return () => ac.abort();
  }, [value.pincode]);

  const current = look.pin === value.pincode ? look : { state: isPincode(value.pincode) ? 'loading' : 'idle', text: '' };
  const hint = current.state === 'idle' ? 'City and state fill in from it.' : current.state === 'loading' ? 'Finding your city…' : current.text;
  const tone = current.state === 'ok' ? 'ok' : current.state === 'warn' ? 'warn' : undefined;
  return (
    <>
      <div className="grid-2">
        <Field id={`${idPrefix}-pin`} label="Pincode" error={errors.pincode} hint={errors.pincode ? undefined : (current.state === 'ok' ? <><Icon name="check" size="sm" />{hint}</> : hint)} hintTone={tone}>
          {(p) => (
            <input {...p} className="input" inputMode="numeric" autoComplete="postal-code" maxLength={6} placeholder="6 digits"
              value={value.pincode} onChange={(e) => onChange({ pincode: e.target.value.replace(/\D/g, '').slice(0, 6) })} />
          )}
        </Field>
        <Field id={`${idPrefix}-city`} label="City" error={errors.city}>
          {(p) => <input {...p} className="input" autoComplete="address-level2" maxLength={60} value={value.city} onChange={(e) => onChange({ city: e.target.value })} />}
        </Field>
      </div>
      <Field id={`${idPrefix}-state`} label="State" error={errors.state}>
        {(p) => (
          <select {...p} className="select" autoComplete="address-level1" value={value.state} onChange={(e) => onChange({ state: e.target.value })}>
            <option value="">Choose…</option>
            {config.states.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        )}
      </Field>
    </>
  );
}
