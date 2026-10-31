// My account → Profile: picture, name, email, mobile (changed with a code), place, language,
// birthday and anniversary. Only what changed is sent.
import { useMemo, useRef, useState } from 'react';
import Button from '../../components/Button.jsx';
import Field from '../../components/Field.jsx';
import Alert from '../../components/Alert.jsx';
import PlaceFields from '../../components/PlaceFields.jsx';
import { Avatar } from '../../components/bits.jsx';
import { useToast } from '../../components/Toasts.jsx';
import { useAuth } from '../../auth/useAuth.js';
import { updateCustomer } from '../../auth/session.js';
import { useConfig } from '../../config/useConfig.js';
import { shopApi } from '../../api/shop.js';
import ChangeMobile from './ChangeMobile.jsx';
import WhatsAppHelp from '../../components/WhatsAppHelp.jsx';
import { anniversaryError, cityError, dobError, emailError, nameError, pincodeError, squash } from '../../utils/validate.js';
import { formatMobile } from '../../utils/format.js';

const TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const today = () => new Date().toISOString().slice(0, 10);
const fromCustomer = (c) => ({
  fullName: c.fullName || '', email: c.email || '', pincode: c.pincode || '', city: c.city || '', state: c.state || '',
  language: c.language || '', dateOfBirth: c.dateOfBirth || '', anniversary: c.anniversary || '',
});

function Picture({ customer }) {
  const toast = useToast();
  const { config } = useConfig();
  const input = useRef(null);
  const [busy, setBusy] = useState(null); // 'up' | 'rm'
  const [preview, setPreview] = useState(null);
  const [error, setError] = useState(null);

  async function choose(e) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setError(null);
    if (!TYPES.includes(file.type)) { setError('Choose a JPEG, PNG or WebP photo.'); return; }
    if (file.size > config.limits.avatarMaxBytes) { setError('The photo is larger than 5 MB. Please choose a smaller one.'); return; }
    const url = URL.createObjectURL(file);
    setPreview(url);
    setBusy('up');
    try {
      const { customer: c } = await shopApi.uploadAvatar(file);
      updateCustomer(c);
      toast('Profile picture saved');
    } catch (ex) {
      setError(ex.message);
    } finally {
      URL.revokeObjectURL(url);
      setPreview(null);
      setBusy(null);
    }
  }

  async function remove() {
    setBusy('rm');
    setError(null);
    try {
      const { customer: c } = await shopApi.removeAvatar();
      updateCustomer(c);
      toast('Profile picture removed');
    } catch (ex) {
      setError(ex.message);
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="pic-row">
      <span className={busy === 'up' ? 'pic-busy' : ''}><Avatar name={customer.fullName} url={preview || customer.avatarUrl} size={84} /></span>
      <div className="stack-sm">
        <b>Profile picture</b>
        <div className="row-wrap">
          <Button size="sm" icon="plus" loading={busy === 'up'} onClick={() => input.current?.click()}>{customer.avatarUrl ? 'Change' : 'Add a picture'}</Button>
          <input ref={input} type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" tabIndex={-1} aria-label="Choose a profile picture" onChange={choose} />
          {customer.avatarUrl ? <Button size="sm" kind="ghost" loading={busy === 'rm'} onClick={remove}>Remove</Button> : null}
        </div>
        {error ? <p className="field-error" role="alert">{error}</p> : <span className="field-hint">Optional. Made small (256 × 256) and saved without location details.</span>}
      </div>
    </div>
  );
}

export default function ProfilePage() {
  const { customer } = useAuth();
  const { config } = useConfig();
  const toast = useToast();
  const base = useMemo(() => fromCustomer(customer), [customer]);
  const [v, setV] = useState(base);
  const [errors, setErrors] = useState({});
  const [emailHelp, setEmailHelp] = useState(false); // the email is on another account
  const [alert, setAlert] = useState(null);
  const [busy, setBusy] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const formRef = useRef(null);

  const set = (patch) => {
    setV((x) => ({ ...x, ...patch }));
    setErrors((e) => { const n = { ...e }; for (const k of Object.keys(patch)) delete n[k]; return n; });
  };

  async function save(e) {
    e.preventDefault();
    if (busy) return;
    setAlert(null);
    const errs = {};
    const checks = { fullName: nameError(v.fullName), email: emailError(v.email), pincode: pincodeError(v.pincode), city: cityError(v.city), state: v.state ? null : 'Choose your state.', dateOfBirth: dobError(v.dateOfBirth), anniversary: anniversaryError(v.anniversary) };
    for (const [k, msg] of Object.entries(checks)) if (msg) errs[k] = msg;
    setErrors(errs);
    if (Object.keys(errs).length) {
      formRef.current?.querySelector('[aria-invalid="true"]')?.focus();
      return;
    }
    const now = { ...v, fullName: squash(v.fullName), email: v.email.trim().toLowerCase(), city: squash(v.city) };
    const patch = {};
    for (const k of Object.keys(now)) {
      if (k === 'email' ? now.email !== (base.email || '').toLowerCase() : now[k] !== base[k]) {
        patch[k] = ['dateOfBirth', 'anniversary', 'language'].includes(k) && !now[k] ? null : now[k];
      }
    }
    if (!Object.keys(patch).length) { toast('No changes to save', { tone: 'info' }); return; }
    setBusy(true);
    try {
      const r = await shopApi.updateMe(patch);
      updateCustomer(r.customer);
      setV(fromCustomer(r.customer));
      toast('Profile saved');
    } catch (ex) {
      if (ex.code === 'VALIDATION_FAILED' || ex.code === 'EMAIL_TAKEN' || ex.code === 'PINCODE_NOT_FOUND') {
        const er = Object.keys(ex.fieldErrors).length ? ex.fieldErrors : { pincode: ex.message };
        if (ex.code === 'PINCODE_NOT_FOUND') er.pincode = ex.message;
        setErrors(er);
        setEmailHelp(ex.code === 'EMAIL_TAKEN');
      } else setAlert({ text: ex.message, reference: ex.reference });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="stack-lg">
      <form ref={formRef} className="card stack" onSubmit={save} noValidate style={{ maxWidth: 760 }}>
        <Picture customer={customer} />
        <div className="grid-2">
          <Field label="Full name" error={errors.fullName}>
            {(a) => <input {...a} className="input" autoComplete="name" maxLength={60} value={v.fullName} onChange={(e) => set({ fullName: e.target.value })} />}
          </Field>
          <div className="stack-sm">
            <Field label="Email" error={errors.email}>
              {(a) => <input {...a} className="input" type="email" inputMode="email" autoComplete="email" maxLength={254} value={v.email} onChange={(e) => { setEmailHelp(false); set({ email: e.target.value }); }} />}
            </Field>
            {emailHelp && errors.email ? <WhatsAppHelp text="This is my email: message the shop" message={`Hello Nandam Handlooms, I want to use my email ${v.email.trim()} on my account, but it says it is on another account.`} /> : null}
          </div>
        </div>
        <Field label="Mobile number" hint={customer.managedByShop ? 'This number is also used for the shop\'s staff app, so only the shop owner can change it.' : 'Changing it needs a code sent to the new number.'}>
          {(a) => (
            <div className="input-group">
              <span className="pre" aria-hidden="true">+91</span>
              <input {...a} className="input" value={formatMobile(customer.mobile)} readOnly aria-readonly="true" />
              {!customer.managedByShop ? <button type="button" className="btn btn-ghost" onClick={() => setMobileOpen(true)}>Change</button> : null}
            </div>
          )}
        </Field>
        <PlaceFields idPrefix="pf" value={v} onChange={set} errors={errors} />
        <div className="grid-2">
          <Field label="Preferred language" optional error={errors.language}>
            {(a) => (
              <select {...a} className="select" value={v.language} onChange={(e) => set({ language: e.target.value })}>
                <option value="">Not set</option>
                {config.languages.map((l) => <option key={l.code} value={l.code}>{l.name}</option>)}
              </select>
            )}
          </Field>
          <div />
        </div>
        <div className="grid-2">
          <Field label="Date of birth" optional error={errors.dateOfBirth} hint="For a birthday surprise.">
            {(a) => <input {...a} className="input" type="date" max={today()} min="1915-01-01" value={v.dateOfBirth} onChange={(e) => set({ dateOfBirth: e.target.value })} />}
          </Field>
          <Field label="Anniversary" optional error={errors.anniversary}>
            {(a) => <input {...a} className="input" type="date" max={today()} min="1940-01-01" value={v.anniversary} onChange={(e) => set({ anniversary: e.target.value })} />}
          </Field>
        </div>
        {alert ? <Alert tone="bad" title="Your changes weren't saved">{alert.text}{alert.reference ? <> Reference: {alert.reference}.</> : null}</Alert> : null}
        <div><Button type="submit" kind="primary" loading={busy}>Save changes</Button></div>
      </form>
      {mobileOpen ? <ChangeMobile current={customer.mobile} onClose={() => setMobileOpen(false)} /> : null}
    </div>
  );
}
