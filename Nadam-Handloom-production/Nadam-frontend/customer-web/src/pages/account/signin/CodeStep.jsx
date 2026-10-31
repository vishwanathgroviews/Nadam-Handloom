// Step 2: the 6-digit SMS code. Wrong code: tries left. Used up or expired: a new code.
import { useEffect, useState } from 'react';
import Button from '../../../components/Button.jsx';
import Alert from '../../../components/Alert.jsx';
import CodeInput from '../../../components/CodeInput.jsx';
import Icon from '../../../components/Icon.jsx';
import { shopApi } from '../../../api/shop.js';
import { useToast } from '../../../components/Toasts.jsx';
import { formatMobile } from '../../../utils/format.js';
import { waitText } from '../../../api/errors.js';
import WhatsAppHelp from '../../../components/WhatsAppHelp.jsx';

function useSecondsLeft(until) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!until) return undefined;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [until]);
  return until ? Math.max(0, Math.ceil((until - now) / 1000)) : 0;
}

export default function CodeStep({ headRef, mobile, sent, total, onChangeNumber, onResent, onSignedIn, onNeedsProfile }) {
  const toast = useToast();
  const [code, setCode] = useState('');
  const [error, setError] = useState(null);
  const [problem, setProblem] = useState(null); // an alert below the boxes
  const [needNew, setNeedNew] = useState(false); // used up or expired: only a new code helps
  const [shake, setShake] = useState(0);
  const [busy, setBusy] = useState(false);
  const [resending, setResending] = useState(false);
  const resendLeft = useSecondsLeft(sent?.resendAt);

  async function verify(value = code) {
    if (busy) return;
    setProblem(null);
    if (value.length !== 6) { setError('Enter all 6 digits.'); return; }
    if (sent?.expiresAt && Date.now() > sent.expiresAt) { setError('This code has expired. Get a new code.'); setNeedNew(true); return; }
    setError(null);
    setBusy(true);
    try {
      const reply = await shopApi.verifyCode(mobile, value);
      if (reply.status === 'signed_in') onSignedIn(reply);
      else onNeedsProfile(reply);
    } catch (ex) {
      setBusy(false);
      if (ex.code === 'WRONG_CODE') {
        setError(ex.message);
        setCode('');
        setShake((n) => n + 1);
      } else if (ex.code === 'CODE_USED_UP' || ex.code === 'CODE_EXPIRED' || ex.code === 'CODE_ALREADY_USED') {
        setError(ex.message);
        setCode('');
        setNeedNew(true);
      } else if (ex.code === 'VALIDATION_FAILED') {
        setError(ex.fieldErrors.code || ex.message);
      } else if (ex.code === 'ACCOUNT_MANAGED_BY_SHOP') {
        setProblem({ title: 'This number can\'t sign in here', text: ex.message, whatsapp: true });
      } else {
        setProblem({ title: 'We couldn\'t check the code', text: ex.message, reference: ex.reference });
      }
    }
  }

  async function resend() {
    if (resending || resendLeft > 0) return;
    setResending(true);
    setProblem(null);
    try {
      const reply = await shopApi.sendCode(mobile);
      setCode('');
      setError(null);
      setNeedNew(false);
      toast(`New code sent to +91 ${formatMobile(mobile)}`);
      onResent(reply);
    } catch (ex) {
      if (ex.code === 'CODE_RESEND_WAIT') onResent({ resendInSeconds: ex.retryAfterSeconds || 60, expiresInSeconds: null, waited: true });
      else {
        setProblem({
          title: ex.code === 'CODE_TOO_MANY' || ex.code === 'CODE_TOO_MANY_NETWORK' ? 'Too many codes for now' : 'The code wasn\'t sent',
          text: `${ex.message}${ex.retryAfterSeconds && ex.code !== 'CODE_RESEND_WAIT' ? ` (${waitText(ex.retryAfterSeconds)})` : ''}`,
          whatsapp: ['SMS_PAUSED', 'SMS_UNAVAILABLE', 'CODE_TOO_MANY_NETWORK'].includes(ex.code),
        });
      }
    } finally {
      setResending(false);
    }
  }

  return (
    <>
      <span className="eyebrow">Step 2 of {total}</span>
      <h1 ref={headRef} tabIndex={-1}>Enter the code</h1>
      <p className="muted">
        We sent a 6-digit code by SMS to <b style={{ color: 'var(--ink)' }}>+91 {formatMobile(mobile)}</b>.{' '}
        <button type="button" className="link" onClick={onChangeNumber}>Change number</button>
      </p>
      {sent?.waited ? <Alert title="A code was sent a moment ago">Enter that code, or ask for a new one when the timer ends.</Alert> : null}
      <form className="stack" onSubmit={(e) => { e.preventDefault(); verify(); }} noValidate>
        <CodeInput value={code} onChange={(v) => { setCode(v); if (error && !needNew) setError(null); }} onComplete={(v) => verify(v)} error={error} shakeKey={shake} disabled={busy} />
        {problem ? (
          <Alert tone="bad" title={problem.title} actions={problem.whatsapp ? <WhatsAppHelp button text="WhatsApp us" /> : <Button size="sm" onClick={() => verify()}>Try again</Button>}>
            {problem.text}{problem.reference ? <> Reference: {problem.reference}.</> : null}
          </Alert>
        ) : null}
        {needNew ? (
          <Button kind="primary" size="lg" block loading={resending} disabled={resendLeft > 0} onClick={resend} icon="refresh">
            {resendLeft > 0 ? `Get a new code in ${resendLeft}s` : 'Get a new code'}
          </Button>
        ) : (
          <Button type="submit" kind="primary" size="lg" block loading={busy}>Verify and continue</Button>
        )}
        {!needNew ? (
          <p className="muted resend" aria-live="polite">
            {resendLeft > 0 ? <>Didn't get it? You can ask for a new code in <b className="tnum">{resendLeft}</b>s.</> : (
              <Button size="sm" onClick={resend} loading={resending} icon="refresh">Send a new code</Button>
            )}
          </p>
        ) : null}
        <p className="note" style={{ justifyContent: 'center' }}><Icon name="info" size="sm" />Codes can take up to a minute to arrive.{sent?.lifeSeconds ? ` Each code works for ${waitText(sent.lifeSeconds)}.` : ''}</p>
        {sent?.devCode ? <p className="dev-code" role="note">Test mode (no SMS sent): the code is <b className="tnum">{sent.devCode}</b></p> : null}
      </form>
    </>
  );
}
