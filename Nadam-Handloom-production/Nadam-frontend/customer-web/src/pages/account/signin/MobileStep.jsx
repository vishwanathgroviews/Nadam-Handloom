// Step 1: the mobile number. The same reply whether or not the number has an account.
import { useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import Button from '../../../components/Button.jsx';
import Alert from '../../../components/Alert.jsx';
import MobileInput from '../../../components/MobileInput.jsx';
import { shopApi } from '../../../api/shop.js';
import { useConfig } from '../../../config/useConfig.js';
import { cleanMobile, mobileError } from '../../../utils/validate.js';
import { waitText } from '../../../api/errors.js';

export default function MobileStep({ headRef, mobile, setMobile, notice, onSent }) {
  const [value, setValue] = useState(mobile ? `${mobile.slice(0, 5)} ${mobile.slice(5)}` : '');
  const [fieldError, setFieldError] = useState(null);
  const [alert, setAlert] = useState(null);
  const { config } = useConfig();
  const [busy, setBusy] = useState(false);
  const trapRef = useRef(null);
  const inputRef = useRef(null);

  async function submit(e) {
    e?.preventDefault();
    if (busy) return;
    setAlert(null);
    const err = mobileError(value);
    setFieldError(err);
    if (err) { inputRef.current?.focus(); return; }
    const number = cleanMobile(value);
    setBusy(true);
    try {
      const reply = await shopApi.sendCode(number, trapRef.current?.value || undefined);
      setMobile(number);
      onSent(reply, number);
    } catch (ex) {
      setBusy(false);
      switch (ex.code) {
        case 'VALIDATION_FAILED':
          setFieldError(ex.fieldErrors.mobile || ex.message);
          inputRef.current?.focus();
          break;
        case 'CODE_RESEND_WAIT':
          // A code went to this number a moment ago: enter that one, or wait for a new one.
          setMobile(number);
          onSent({ resendInSeconds: ex.retryAfterSeconds || 60, expiresInSeconds: null, waited: true }, number);
          break;
        case 'CODE_TOO_MANY':
        case 'CODE_TOO_MANY_NETWORK':
        case 'RATE_LIMITED':
          setAlert({ tone: 'warn', title: 'Too many codes for now', text: `${ex.message} For your safety we limit codes. You can also message us on WhatsApp.`, wait: ex.retryAfterSeconds });
          break;
        case 'SMS_PAUSED':
        case 'SMS_UNAVAILABLE':
          setAlert({ tone: 'bad', title: 'We couldn\'t send the code', text: ex.message, whatsapp: true });
          break;
        default:
          setAlert({ tone: 'bad', title: 'The code wasn\'t sent', text: ex.message, retry: true, reference: ex.reference });
      }
    }
  }

  return (
    <>
      <span className="eyebrow">Sign in or create an account</span>
      <h1 ref={headRef} tabIndex={-1}>Welcome</h1>
      <p className="muted">Enter your mobile number. We'll text you a code: no password to remember.</p>
      {notice ? <Alert tone={notice.tone} title={notice.title}>{notice.text}</Alert> : null}
      <form className="stack" onSubmit={submit} noValidate>
        <MobileInput value={value} onChange={(v) => { setValue(v); if (fieldError) setFieldError(null); }} error={fieldError} autoFocus inputRef={inputRef} />
        {alert ? (
          <Alert
            tone={alert.tone}
            title={alert.title}
            actions={alert.retry ? <Button size="sm" onClick={submit}>Try again</Button> : alert.whatsapp ? <a className="btn btn-sm" href={`https://wa.me/${config.store.whatsapp}`} target="_blank" rel="noopener noreferrer">WhatsApp us</a> : null}
          >
            {alert.text}
            {alert.wait ? <> You can try again in {waitText(alert.wait)}.</> : null}
            {alert.reference ? <> Reference: {alert.reference}.</> : null}
          </Alert>
        ) : null}
        {/* A field people never see or fill: bots do. */}
        <input ref={trapRef} className="trap" type="text" name="alt_contact" tabIndex={-1} autoComplete="off" aria-hidden="true" defaultValue="" />
        <Button type="submit" kind="primary" size="lg" block loading={busy}>Send code</Button>
        <p className="note" style={{ justifyContent: 'center', textAlign: 'center' }}>
          <span>By continuing you agree to our <Link className="link" to="/terms">terms</Link> and <Link className="link" to="/privacy">privacy policy</Link>.</span>
        </p>
      </form>
    </>
  );
}
