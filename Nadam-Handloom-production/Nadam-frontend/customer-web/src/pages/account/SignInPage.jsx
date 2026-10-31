// Sign in or create an account (W1, web-01 section 4.1): mobile → SMS code → (new
// customers) a short profile. One flow for both; the same steps will sit inside checkout.
import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../auth/useAuth.js';
import { useConfig } from '../../config/useConfig.js';
import { signedIn } from '../../auth/session.js';
import { useToast } from '../../components/Toasts.jsx';
import { BackRow } from '../../components/bits.jsx';
import MobileStep from './signin/MobileStep.jsx';
import CodeStep from './signin/CodeStep.jsx';
import ProfileStep from './signin/ProfileStep.jsx';
import { safeNext } from '../../utils/validate.js';
import { firstName } from '../../utils/format.js';
import { useTitle } from '../../utils/useTitle.js';

const ART = {
  mobile: ['signin-mobile', 'Woven in Mangalagiri, delivered to you', 'Sign in to check out faster and follow your orders.'],
  code: ['signin-code', 'Almost there', 'One code and you\'re in. You stay signed in for 30 days.'],
  profile: ['signin-profile', 'Welcome to Nandam', 'A few details, once, and you\'re ready to shop.'],
};

export default function SignInPage() {
  const [params] = useSearchParams();
  const next = safeNext(params.get('next'));
  const navigate = useNavigate();
  const toast = useToast();
  const { status } = useAuth();
  const { config } = useConfig();
  const [step, setStep] = useState('mobile');
  const [mobile, setMobile] = useState('');
  const [sent, setSent] = useState(null); // the code: { resendAt, expiresAt, devCode, waited }
  const [profile, setProfile] = useState(null); // { stepToken, prefill, mobileMasked }
  const [notice, setNotice] = useState(null); // shown on the mobile step
  const finished = useRef(false);
  const headRef = useRef(null);

  useTitle(step === 'profile' ? 'Complete your profile' : 'Sign in');

  // Already signed in (another tab, or back here by mistake): go on.
  useEffect(() => {
    if (status === 'signedIn' && !finished.current) navigate(next, { replace: true });
  }, [status, next, navigate]);

  // The profile step: focus its heading, for keyboards and screen readers. (The mobile and
  // code steps put the cursor straight in their first box.)
  useEffect(() => { if (step === 'profile') headRef.current?.focus({ preventScroll: true }); }, [step]);

  function codeSent(reply, number) {
    const now = Date.now();
    setMobile(number);
    setSent({
      resendAt: now + (reply.resendInSeconds ?? 60) * 1000,
      expiresAt: reply.expiresInSeconds ? now + reply.expiresInSeconds * 1000 : null,
      lifeSeconds: reply.expiresInSeconds || null,
      devCode: reply.devCode || null,
      waited: !!reply.waited,
    });
    setNotice(null);
    setStep('code');
  }

  function done(reply, isNew) {
    finished.current = true;
    signedIn(reply);
    const name = firstName(reply.customer.fullName);
    toast(isNew ? `Account created. Welcome, ${name}!` : `Welcome back, ${name}`);
    // An account waiting to be deleted opens My account, where "Keep my account" is.
    navigate(reply.customer.deletion ? '/account' : next, { replace: true });
  }

  const [img, quote, sub] = ART[step];
  const total = step === 'mobile' ? 3 : profile || step === 'profile' ? 3 : 2;
  const index = { mobile: 1, code: 2, profile: 3 }[step];
  return (
    <div className="auth page-enter">
      <div className="art" aria-hidden="true">
        <picture>
          <source srcSet={`/img/${img}.webp`} type="image/webp" />
          <img src={`/img/${img}.jpg`} alt="" />
        </picture>
        <div className="q">
          <span className="eyebrow">Nandam Handlooms</span>
          <b>{quote}</b>
          <span>{sub}</span>
        </div>
      </div>
      <div className="form">
        <div>
          <BackRow />
          <div className="auth-steps" role="progressbar" aria-label="Sign-in steps" aria-valuemin={1} aria-valuemax={total} aria-valuenow={index} aria-valuetext={`Step ${index} of ${total}`}>
            {Array.from({ length: total }, (_, i) => <i key={i} className={i < index ? 'on' : ''} />)}
          </div>
          {step === 'mobile' ? (
            <MobileStep headRef={headRef} mobile={mobile} setMobile={setMobile} notice={notice} onSent={codeSent} />
          ) : null}
          {step === 'code' ? (
            <CodeStep
              headRef={headRef}
              mobile={mobile}
              sent={sent}
              total={total}
              onChangeNumber={() => { setStep('mobile'); setSent(null); }}
              onResent={(reply) => codeSent(reply, mobile)}
              onSignedIn={(reply) => done(reply, false)}
              onNeedsProfile={(reply) => { setProfile(reply); setStep('profile'); }}
            />
          ) : null}
          {step === 'profile' && profile ? (
            <ProfileStep
              headRef={headRef}
              profile={profile}
              onSignedIn={(reply) => done(reply, true)}
              onStepExpired={(why) => {
                setProfile(null);
                setSent(null);
                setNotice(why === 'used'
                  ? { tone: 'info', title: 'You have already signed up', text: 'Enter your mobile number to sign in.' }
                  : { tone: 'warn', title: 'Please confirm your number again', text: 'That took longer than 15 minutes, so we need a new code. What you typed in your profile is kept.' });
                setStep('mobile');
              }}
            />
          ) : null}
          <p className="switch">Need help? <a href={`https://wa.me/${config.store.whatsapp}`} target="_blank" rel="noopener noreferrer">Message us on WhatsApp</a> · <Link to="/privacy">Privacy</Link></p>
        </div>
      </div>
    </div>
  );
}
