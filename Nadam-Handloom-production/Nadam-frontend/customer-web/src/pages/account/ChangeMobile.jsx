// Change of mobile: the new number gets a code; once it's entered, the new number signs in.
import { useEffect, useState } from 'react';
import Modal from '../../components/Modal.jsx';
import Button from '../../components/Button.jsx';
import Alert from '../../components/Alert.jsx';
import MobileInput from '../../components/MobileInput.jsx';
import CodeInput from '../../components/CodeInput.jsx';
import { useToast } from '../../components/Toasts.jsx';
import { updateCustomer } from '../../auth/session.js';
import { shopApi } from '../../api/shop.js';
import { cleanMobile, mobileError } from '../../utils/validate.js';
import { formatMobile } from '../../utils/format.js';
import { waitText } from '../../api/errors.js';

export default function ChangeMobile({ current, onClose }) {
  const toast = useToast();
  const [stage, setStage] = useState('number');
  const [value, setValue] = useState('');
  const [mobile, setMobile] = useState('');
  const [code, setCode] = useState('');
  const [error, setError] = useState(null);
  const [alert, setAlert] = useState(null);
  const [busy, setBusy] = useState(false);
  const [shake, setShake] = useState(0);
  const [devCode, setDevCode] = useState(null);
  const [resendAt, setResendAt] = useState(0);
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(t); }, []);
  const left = Math.max(0, Math.ceil((resendAt - now) / 1000));

  async function sendCode(number) {
    setBusy(true);
    setAlert(null);
    try {
      const r = await shopApi.mobileCode(number);
      setMobile(number);
      setDevCode(r.devCode || null);
      setResendAt(Date.now() + (r.resendInSeconds || 60) * 1000);
      setCode('');
      setError(null);
      setStage('code');
    } catch (ex) {
      if (ex.code === 'CODE_RESEND_WAIT') { setMobile(number); setResendAt(Date.now() + (ex.retryAfterSeconds || 60) * 1000); setStage('code'); }
      else if (['SAME_MOBILE', 'MOBILE_TAKEN', 'VALIDATION_FAILED'].includes(ex.code)) setError(ex.fieldErrors.mobile || ex.message);
      else setAlert({ text: `${ex.message}${ex.retryAfterSeconds ? ` Try again in ${waitText(ex.retryAfterSeconds)}.` : ''}` });
    } finally {
      setBusy(false);
    }
  }

  async function submitNumber(e) {
    e.preventDefault();
    const err = mobileError(value);
    if (err) { setError(err); return; }
    const number = cleanMobile(value);
    if (number === current) { setError('This is already your mobile number.'); return; }
    await sendCode(number);
  }

  async function verify(value2 = code) {
    if (busy) return;
    if (value2.length !== 6) { setError('Enter all 6 digits.'); return; }
    setBusy(true);
    setAlert(null);
    try {
      const r = await shopApi.mobileVerify(mobile, value2);
      updateCustomer(r.customer);
      toast('Mobile number changed');
      onClose();
    } catch (ex) {
      setBusy(false);
      if (ex.code === 'WRONG_CODE') { setError(ex.message); setCode(''); setShake((n) => n + 1); }
      else if (ex.code === 'CODE_USED_UP' || ex.code === 'CODE_EXPIRED') { setError(ex.message); setCode(''); }
      else if (ex.code === 'MOBILE_TAKEN') { setStage('number'); setError(ex.message); }
      else setAlert({ text: ex.message });
    }
  }

  return (
    <Modal title="Change mobile number" onClose={onClose} busy={busy} labelledBy="cm-title">
      <h3 id="cm-title">{stage === 'number' ? 'Change mobile number' : 'Enter the code'}</h3>
      {stage === 'number' ? (
        <form className="stack" onSubmit={submitNumber} noValidate>
          <p className="muted">We'll send a code to the new number. Your orders and addresses stay with your account.</p>
          <MobileInput label="New mobile number" value={value} onChange={(x) => { setValue(x); setError(null); }} error={error} autoFocus />
          {alert ? <Alert tone="bad">{alert.text}</Alert> : null}
          <div className="acts">
            <Button onClick={onClose} disabled={busy}>Cancel</Button>
            <Button type="submit" kind="primary" loading={busy}>Send code</Button>
          </div>
        </form>
      ) : (
        <form className="stack" onSubmit={(e) => { e.preventDefault(); verify(); }} noValidate>
          <p className="muted">Sent to +91 {formatMobile(mobile)}. <button type="button" className="link" onClick={() => { setStage('number'); setError(null); }}>Change</button></p>
          <CodeInput value={code} onChange={(x) => { setCode(x); setError(null); }} onComplete={verify} error={error} shakeKey={shake} disabled={busy} />
          {alert ? <Alert tone="bad">{alert.text}</Alert> : null}
          {devCode ? <p className="dev-code" role="note">Test mode (no SMS sent): the code is <b className="tnum">{devCode}</b></p> : null}
          <p className="muted small">{left > 0 ? <>New code in <b className="tnum">{left}</b>s</> : <button type="button" className="link" onClick={() => sendCode(mobile)}>Send a new code</button>}</p>
          <div className="acts">
            <Button onClick={onClose} disabled={busy}>Cancel</Button>
            <Button type="submit" kind="primary" loading={busy}>Verify</Button>
          </div>
        </form>
      )}
    </Modal>
  );
}
