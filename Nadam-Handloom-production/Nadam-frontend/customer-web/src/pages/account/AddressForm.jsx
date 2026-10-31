// Add or edit an address: in a dialog (My account), or inside the checkout page (`inline`).
// Pincode fills city and state. `problem` ({ field, message }): what an address saved on the old
// website must correct before an order can be sent there.
import { useState } from 'react';
import Modal from '../../components/Modal.jsx';
import Button from '../../components/Button.jsx';
import Field from '../../components/Field.jsx';
import Alert from '../../components/Alert.jsx';
import MobileInput from '../../components/MobileInput.jsx';
import PlaceFields from '../../components/PlaceFields.jsx';
import { shopApi } from '../../api/shop.js';
import { cityError, cleanMobile, mobileError, nameError, pincodeError, squash } from '../../utils/validate.js';
import { formatMobile } from '../../utils/format.js';

const LABELS = [['home', 'Home'], ['office', 'Office'], ['other', 'Other']];

export default function AddressForm({ address, customer, isFirst, onClose, onSaved, inline = false, problem = null, saveText }) {
  const editing = !!address;
  const [v, setV] = useState(() => ({
    label: address?.label || 'home',
    fullName: address?.fullName || customer.fullName || '',
    mobile: formatMobile(address?.mobile || customer.mobile || ''),
    line1: address?.line1 || '',
    line2: address?.line2 || '',
    landmark: address?.landmark || '',
    pincode: address?.pincode || '',
    city: address?.city || '',
    state: address?.state || '',
    isDefault: address?.isDefault || false,
  }));
  const [errors, setErrors] = useState(() => (problem?.field ? { [problem.field]: problem.message } : {}));
  const [alert, setAlert] = useState(null);
  const [busy, setBusy] = useState(false);
  const set = (patch) => {
    setV((x) => ({ ...x, ...patch }));
    setErrors((e) => { const n = { ...e }; for (const k of Object.keys(patch)) delete n[k]; return n; });
  };

  async function save(e) {
    e.preventDefault();
    if (busy) return;
    setAlert(null);
    const errs = {};
    const checks = {
      fullName: nameError(v.fullName), mobile: mobileError(v.mobile),
      line1: squash(v.line1).length < 3 ? 'Enter the house or flat number and building.' : null,
      pincode: pincodeError(v.pincode), city: cityError(v.city), state: v.state ? null : 'Choose the state.',
    };
    for (const [k, m] of Object.entries(checks)) if (m) errs[k] = m;
    setErrors(errs);
    if (Object.keys(errs).length) return;
    const body = {
      label: v.label, fullName: squash(v.fullName), mobile: cleanMobile(v.mobile), line1: squash(v.line1), line2: squash(v.line2),
      landmark: squash(v.landmark), pincode: v.pincode, city: squash(v.city), state: v.state,
      ...(v.isDefault && !address?.isDefault ? { isDefault: true } : {}),
    };
    setBusy(true);
    try {
      const r = editing ? await shopApi.updateAddress(address.id, body) : await shopApi.addAddress(body);
      onSaved(r, editing);
    } catch (ex) {
      setBusy(false);
      if (Object.keys(ex.fieldErrors).length) setErrors(ex.fieldErrors);
      else if (ex.code === 'PINCODE_NOT_FOUND') setErrors({ pincode: ex.message });
      else setAlert(ex.message);
    }
  }

  const title = problem ? 'Please check this address' : editing ? 'Edit address' : 'New address';
  const form = (
    <form className="stack" onSubmit={save} noValidate>
      {problem && inline ? <Alert tone="warn" title="Please check this address">It was saved on our old website and needs a small correction before we can deliver there: {problem.message.charAt(0).toLowerCase()}{problem.message.slice(1)}</Alert> : null}
      <div className="grid-2">
        <Field label="Full name" error={errors.fullName}>
          {(a) => <input {...a} className="input" autoComplete="name" maxLength={60} value={v.fullName} onChange={(e) => set({ fullName: e.target.value })} />}
        </Field>
        <MobileInput label="Mobile for delivery" value={v.mobile} onChange={(m) => set({ mobile: m })} error={errors.mobile} />
      </div>
      <Field label="House, flat, building" error={errors.line1}>
        {(a) => <input {...a} className="input" autoComplete="address-line1" maxLength={120} placeholder="Flat 302, Sri Sai Residency" value={v.line1} onChange={(e) => set({ line1: e.target.value })} />}
      </Field>
      <div className="grid-2">
        <Field label="Area, street" optional error={errors.line2}>
          {(a) => <input {...a} className="input" autoComplete="address-line2" maxLength={120} value={v.line2} onChange={(e) => set({ line2: e.target.value })} />}
        </Field>
        <Field label="Landmark" optional error={errors.landmark}>
          {(a) => <input {...a} className="input" maxLength={80} placeholder="Near the temple" value={v.landmark} onChange={(e) => set({ landmark: e.target.value })} />}
        </Field>
      </div>
      <PlaceFields idPrefix={inline ? 'co-af' : 'af'} value={v} onChange={set} errors={errors} />
      <fieldset className="plain">
        <legend className="label">Save as</legend>
        <div className="chips">
          {LABELS.map(([value, text]) => (
            <label key={value} className="chip">
              <input type="radio" name={inline ? 'co-af-label' : 'af-label'} value={value} checked={v.label === value} onChange={() => set({ label: value })} />
              {text}
            </label>
          ))}
        </div>
      </fieldset>
      {!isFirst && !address?.isDefault ? (
        <label className="check"><input type="checkbox" checked={v.isDefault} onChange={(e) => set({ isDefault: e.target.checked })} /><span>Make this my default address</span></label>
      ) : null}
      {alert ? <Alert tone="bad">{alert}</Alert> : null}
      <div className={inline ? 'row-wrap' : 'acts'}>
        {inline ? null : <Button onClick={onClose} disabled={busy}>Cancel</Button>}
        <Button type="submit" kind="primary" size={inline ? 'lg' : undefined} loading={busy}>{saveText || 'Save address'}</Button>
        {inline && onClose ? <Button kind="ghost" onClick={onClose} disabled={busy}>Cancel</Button> : null}
      </div>
    </form>
  );

  if (inline) {
    return (
      <div className="ad-form">
        {problem ? null : <h3 className="h-sm">{title}</h3>}
        {form}
      </div>
    );
  }
  return (
    <Modal title={title} onClose={onClose} busy={busy} wide labelledBy="af-title">
      <h3 id="af-title">{title}</h3>
      {problem ? <Alert tone="warn">{problem.message}</Alert> : null}
      {form}
    </Modal>
  );
}
