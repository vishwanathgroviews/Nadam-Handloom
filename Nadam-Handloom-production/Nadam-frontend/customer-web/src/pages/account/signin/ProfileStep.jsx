// Step 3 (new customers, once): full name, email, pincode → city and state, offers tick.
import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import Button from '../../../components/Button.jsx';
import Alert from '../../../components/Alert.jsx';
import Field from '../../../components/Field.jsx';
import Icon from '../../../components/Icon.jsx';
import PlaceFields from '../../../components/PlaceFields.jsx';
import WhatsAppHelp from '../../../components/WhatsAppHelp.jsx';
import { shopApi } from '../../../api/shop.js';
import { firstVisit } from '../../../utils/attribution.js';
import { cityError, emailError, nameError, pincodeError, squash } from '../../../utils/validate.js';

const DRAFT = 'nh-profile-draft';
const readDraft = () => { try { return JSON.parse(sessionStorage.getItem(DRAFT) || 'null'); } catch { return null; } };
const saveDraft = (v) => { try { sessionStorage.setItem(DRAFT, JSON.stringify(v)); } catch { /* private mode */ } };
const clearProfileDraft = () => { try { sessionStorage.removeItem(DRAFT); } catch { /* private mode */ } };

const FIELDS = ['fullName', 'email', 'pincode', 'city', 'state'];

export default function ProfileStep({ headRef, profile, onSignedIn, onStepExpired }) {
  const initial = useMemo(() => {
    const p = profile.prefill || {};
    const d = readDraft() || {};
    return {
      fullName: d.fullName ?? p.fullName ?? '', email: d.email ?? p.email ?? '', pincode: d.pincode ?? p.pincode ?? '',
      city: d.city ?? p.city ?? '', state: d.state ?? p.state ?? '', marketingOptIn: d.marketingOptIn ?? !!p.marketingOptIn,
    };
  }, [profile]);
  const [v, setV] = useState(initial);
  const [errors, setErrors] = useState({});
  const [alert, setAlert] = useState(null);
  const [emailHelp, setEmailHelp] = useState(false); // the email is on another account
  const [busy, setBusy] = useState(false);
  const formRef = useRef(null);

  useEffect(() => { saveDraft(v); }, [v]);
  const set = (patch) => {
    setV((x) => ({ ...x, ...patch }));
    setErrors((e) => { const n = { ...e }; for (const k of Object.keys(patch)) delete n[k]; return n; });
  };

  function focusFirst(errs) {
    const k = FIELDS.find((f) => errs[f]);
    const id = { fullName: 'p-name', email: 'p-email', pincode: 'p-pin', city: 'p-city', state: 'p-state' }[k];
    if (id) formRef.current?.querySelector(`#${id}`)?.focus();
  }

  async function submit(e) {
    e?.preventDefault();
    if (busy) return;
    setAlert(null);
    const errs = {};
    const n = nameError(v.fullName); if (n) errs.fullName = n;
    const m = emailError(v.email); if (m) errs.email = m;
    const p = pincodeError(v.pincode); if (p) errs.pincode = p;
    if (!p) {
      const c = cityError(v.city); if (c) errs.city = c;
      if (!v.state) errs.state = 'Choose your state.';
    }
    setErrors(errs);
    if (Object.keys(errs).length) { focusFirst(errs); return; }
    setBusy(true);
    try {
      const reply = await shopApi.complete({
        stepToken: profile.stepToken,
        fullName: squash(v.fullName),
        email: v.email.trim(),
        pincode: v.pincode,
        city: squash(v.city) || undefined,
        state: v.state || undefined,
        marketingOptIn: !!v.marketingOptIn,
        attribution: firstVisit(),
      });
      clearProfileDraft();
      onSignedIn(reply);
    } catch (ex) {
      setBusy(false);
      if (ex.code === 'STEP_EXPIRED') { onStepExpired(); return; }
      if (ex.code === 'STEP_USED') { onStepExpired('used'); return; }
      if (ex.code === 'EMAIL_TAKEN') { const er = { email: ex.message }; setErrors(er); setEmailHelp(true); focusFirst(er); return; }
      if (ex.code === 'ACCOUNT_MANAGED_BY_SHOP') { setAlert({ text: ex.message, whatsapp: true }); return; }
      if (ex.code === 'PINCODE_NOT_FOUND') {
        const er = { pincode: ex.message, ...(v.city ? {} : { city: 'Type your city or town.' }), ...(v.state ? {} : { state: 'Choose your state.' }) };
        setErrors(er); focusFirst(er); return;
      }
      if (ex.code === 'VALIDATION_FAILED' && Object.keys(ex.fieldErrors).length) {
        const er = ex.fieldErrors;
        if (er.stepToken) { onStepExpired(); return; }
        setErrors(er); focusFirst(er); return;
      }
      setAlert({ text: ex.message, reference: ex.reference });
    }
  }

  return (
    <>
      <span className="eyebrow">Step 3 of 3 · New here</span>
      <h1 ref={headRef} tabIndex={-1}>Complete your profile</h1>
      <p className="muted">Once only. We use these to deliver your orders and, if you choose, to tell you about new arrivals.</p>
      <form ref={formRef} className="stack" onSubmit={submit} noValidate>
        <Field id="p-name" label="Full name" error={errors.fullName}>
          {(a) => <input {...a} className="input" autoComplete="name" placeholder="As on your delivery" maxLength={60} value={v.fullName} onChange={(e) => set({ fullName: e.target.value })} />}
        </Field>
        <Field id="p-email" label="Email" error={errors.email} hint="Order confirmations and invoices come here.">
          {(a) => <input {...a} className="input" type="email" autoComplete="email" inputMode="email" placeholder="you@example.com" maxLength={254} value={v.email} onChange={(e) => { setEmailHelp(false); set({ email: e.target.value }); }} />}
        </Field>
        {emailHelp && errors.email ? <WhatsAppHelp text="This is my email: message the shop on WhatsApp" message={`Hello Nandam Handlooms, I'm signing up with my email ${v.email.trim()} but it says it is on another account.`} /> : null}
        <PlaceFields idPrefix="p" value={v} onChange={set} errors={errors} />
        <label className="check">
          <input type="checkbox" checked={v.marketingOptIn} onChange={(e) => set({ marketingOptIn: e.target.checked })} />
          <span>Send me new arrivals and festive offers. You can change this any time.</span>
        </label>
        {alert ? (
          <Alert tone="bad" title="Your account wasn't created yet" actions={alert.whatsapp ? <WhatsAppHelp button text="WhatsApp us" /> : <Button size="sm" onClick={submit}>Try again</Button>}>
            {alert.text}{alert.reference ? <> Reference: {alert.reference}.</> : null}
          </Alert>
        ) : null}
        <Button type="submit" kind="primary" size="lg" block loading={busy}>Create my account</Button>
        <p className="note"><Icon name="shield" size="sm" /><span>We ask only what we need. You can see, change or delete your details in My account. <Link className="link" to="/privacy">How we use them</Link></span></p>
      </form>
    </>
  );
}
