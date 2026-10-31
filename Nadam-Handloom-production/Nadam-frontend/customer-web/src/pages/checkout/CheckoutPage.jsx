// Checkout (/checkout, W6 6.1 A): two steps on one page, 1 Delivery address, 2 Review and pay,
// with the order summary on the right (a Pay bar at the bottom on phones, 6.7 A). Pay makes
// the order on our server from the account's bag, holds the sarees for 15 minutes and opens
// Razorpay's window. Anything that changed since the page showed it stops Pay (rule 7.2).
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Icon from '../../components/Icon.jsx';
import Alert from '../../components/Alert.jsx';
import Button from '../../components/Button.jsx';
import { Crumbs, EmptyState, Skeleton } from '../../components/bits.jsx';
import AddressForm from '../account/AddressForm.jsx';
import { AddressBlock, ConfirmingPayment, HoldLine, SareeLines } from './parts.jsx';
import { clock, gstText } from './format.js';
import { rememberCheckout, rememberedCheckout, usePayment } from './usePayment.js';
import { useBag, bagLines, bagTotals } from '../../bag/useBag.js';
import { openWhatsApp, refresh as refreshBag, takeServerBag } from '../../bag/store.js';
import { shopApi } from '../../api/shop.js';
import { inAppBrowser } from '../../payments/razorpay.js';
import { useAuth } from '../../auth/useAuth.js';
import { paymentsOpen } from '../../payments/usePaymentsOn.js';
import { useConfig } from '../../config/useConfig.js';
import { useOnline } from '../../utils/useOnline.js';
import { useTitle } from '../../utils/useTitle.js';
import { plural } from '../../utils/format.js';
import { pieces, rs } from '../../utils/money.js';
import { prefersReducedMotion } from '../../utils/motion.js';
import '../../theme/checkout.css';
import TestPayNote from '../../payments/TestPayNote.jsx';

const ADDR_KEY = 'nh-co-addr';
const PAID_LIKE = ['paid', 'confirming', 'refunded', 'shipped', 'delivered'];
const RECHECK_MS = 8000; // an open checkout is asked about again while the page waits
const keptAddress = () => { try { return sessionStorage.getItem(ADDR_KEY); } catch { return null; } };
const keepAddress = (id) => { try { sessionStorage.setItem(ADDR_KEY, id); } catch { /* private mode */ } };

const Head = () => (
  <div className="page-head">
    <Crumbs items={[['Home', '/'], ['Your bag', '/bag'], ['Checkout']]} />
    <h1>Checkout</h1>
  </div>
);

// What the page shows for the bag: Pay sends exactly this, and the server compares.
const expectOf = (lines, amount) => ({ amount, lines: lines.map((l) => ({ slug: l.slug, quantity: l.quantity, price: l.price })) });

function Notice({ notice, ended, order, onPay, onChangeBag, onCheckAgain, app }) {
  const until = order?.holdUntil ? <>Your sarees are held for you until <b>{clock(order.holdUntil)}</b>.</> : null;
  if (notice?.kind === 'expired') {
    return <Alert tone="warn" icon="clock" title="The 15 minutes are over" actions={<Button size="sm" kind="primary" onClick={onCheckAgain}>Check my bag again</Button>}>Your sarees were released, so others could buy them. Check your bag again: most are usually still there.</Alert>;
  }
  if (notice?.kind === 'earlier') {
    const o = notice.order;
    const see = <Link className="btn btn-sm" to={`/order/${o.number}`}>See the order</Link>;
    if (o.status === 'refunded') return <Alert title={`Order ${o.number} couldn't be kept`} actions={see}>Your payment for it is being refunded. You can order again below.</Alert>;
    if (o.status === 'confirming') return <Alert title={`Your payment for order ${o.number} is being confirmed`} actions={see}>We&apos;re checking with your bank. You don&apos;t need to pay for it again.</Alert>;
    return <Alert tone="ok" title={`Your payment for order ${o.number} went through`} actions={see}>It&apos;s confirmed, so you don&apos;t need to pay for it again.</Alert>;
  }
  if (notice?.kind === 'changed') return <Alert tone="warn" title="Something changed before you paid">A saree sold or a price changed since this page was opened. Nothing was charged. Check the order below, then pay.</Alert>;
  if (notice?.kind === 'tooLarge') {
    return <Alert tone="warn" title="This order is too large to pay online in one go" actions={<button type="button" className="btn btn-sm btn-wa" onClick={openWhatsApp}><Icon name="whatsapp" size="sm" />Order on WhatsApp</button>}>{notice.message} Nothing was charged.</Alert>;
  }
  if (notice?.kind === 'offline') return <Alert tone="warn" icon="wifioff" title="You're offline">Nothing was charged. Pay works again when you&apos;re back online.</Alert>;
  if (notice?.kind === 'error') return <Alert tone="bad" title="Payment didn't start">{notice.message} Nothing was charged.</Alert>;
  if (ended?.kind === 'failed') {
    return <Alert tone="bad" title="Payment didn't go through. Nothing was taken." actions={<><Button size="sm" kind="primary" onClick={onPay}>Try again</Button><Button size="sm" onClick={onChangeBag}>Change my bag</Button></>}>{ended.reason ? `${ended.reason.replace(/\.?$/, '.')} ` : ''}{until}</Alert>;
  }
  if (ended?.kind === 'closed') {
    return <Alert tone="warn" title="Payment not completed" actions={<><Button size="sm" kind="primary" onClick={onPay}>Pay now</Button><Button size="sm" onClick={onChangeBag}>Change my bag</Button></>}>{until || 'Nothing was charged.'}</Alert>;
  }
  if (ended?.kind === 'script') {
    return (
      <Alert tone="bad" title="The payment window didn't open" actions={<Button size="sm" kind="primary" onClick={onPay}>Try again</Button>}>
        Check your connection and press Pay again. Nothing was charged.{app ? ` Inside ${app}, payments often can't open: open this page in Chrome or Safari.` : ''}
      </Alert>
    );
  }
  return null;
}

function InAppNote({ app }) {
  const [copied, setCopied] = useState(false);
  if (!app) return null;
  const copy = async () => {
    try { await navigator.clipboard.writeText(window.location.href); setCopied(true); } catch { setCopied(false); }
  };
  return (
    <Alert title={`Payments may not open inside ${app}`} actions={<Button size="sm" icon={copied ? 'check' : 'copy'} onClick={copy}>{copied ? 'Link copied' : 'Copy the link'}</Button>}>
      For the smoothest payment, open the website in Chrome or Safari: tap ⋯ at the top, then &quot;Open in browser&quot;. Your bag is saved in your account.
    </Alert>
  );
}

export default function CheckoutPage() {
  useTitle('Checkout');
  const { status: auth, customer } = useAuth();
  const { config, status: cfg } = useConfig();
  const navigate = useNavigate();
  const bag = useBag();
  const online = useOnline();
  const payment = usePayment();
  const app = useMemo(() => inAppBrowser(), []);

  const [addr, setAddr] = useState({ status: 'loading', list: [], max: 10, error: null });
  const [sel, setSel] = useState(null);
  const [done, setDone] = useState(false);
  const [form, setForm] = useState(null); // { mode: 'new' } | { mode: 'fix', address, problem }
  const [order, setOrder] = useState(null); // the open checkout (its hold)
  const [notice, setNotice] = useState(null);
  const reviewRef = useRef(null);
  const signedIn = auth === 'signedIn';
  // While payments are tried on the live website, a visitor is asked to sign in first: the server
  // then says whether this customer may pay (payOnline).
  const paymentsOn = auth === 'signedIn' ? paymentsOpen(config.payments, customer) : config.payments?.enabled === true;

  const loadAddresses = useCallback(async () => {
    setAddr((d) => ({ ...d, status: 'loading', error: null }));
    try {
      const r = await shopApi.addresses();
      setAddr({ status: 'ready', list: r.addresses, max: r.max, error: null });
      setSel((s) => {
        if (s && r.addresses.some((a) => a.id === s)) return s;
        const kept = keptAddress();
        return (r.addresses.find((a) => a.id === kept) || r.addresses.find((a) => a.isDefault) || r.addresses[0])?.id ?? null;
      });
      if (!r.addresses.length) setForm({ mode: 'new' });
    } catch (error) {
      setAddr((d) => ({ ...d, status: 'error', error }));
    }
  }, []);

  useEffect(() => {
    if (!signedIn) return;
    loadAddresses();
    refreshBag();
    // A checkout opened earlier in this tab: its hold still shows, or how it ended (paid through
    // Razorpay's notice after the phone lost the connection, refunded) is said once.
    const kept = rememberedCheckout();
    if (kept) {
      shopApi.order(kept).then(({ order: o }) => {
        if (o.status === 'awaiting_payment') { setOrder(o); return; }
        rememberCheckout(null);
        if (PAID_LIKE.includes(o.status)) setNotice({ kind: 'earlier', order: o });
      }).catch(() => rememberCheckout(null));
    }
  }, [signedIn, loadAddresses]);

  // The open checkout, as our server sees it now. This page's clock can be wrong (a phone set
  // fast), and the payment may have gone through in a UPI app while this page waited: the server
  // decides. Answers 'open' (still held), 'done' (paid, refunded or ended: said here), 'unknown'.
  const { phase, reset, setEnded } = payment;
  const settleOpen = useCallback(async (number) => {
    let o;
    try { ({ order: o } = await shopApi.order(number)); } catch { return 'unknown'; }
    if (o.status === 'awaiting_payment') { setOrder(o); return 'open'; }
    rememberCheckout(null);
    setOrder(null);
    setEnded(null);
    reset();
    setNotice(PAID_LIKE.includes(o.status) ? { kind: 'earlier', order: o } : { kind: 'expired' });
    return 'done';
  }, [reset, setEnded]);

  // While the page waits with a checkout open (Razorpay's window closed), it asks the server
  // again every few seconds and when the hold should end: a payment made meanwhile shows as made,
  // and Pay is never offered for an order that is already paid.
  const holdUntil = order?.holdUntil;
  const openNumber = order?.number;
  useEffect(() => {
    if (!openNumber || phase !== 'idle') return undefined;
    let stop = false;
    let t;
    const ask = async () => {
      if (stop) return;
      if (document.visibilityState === 'visible' && (await settleOpen(openNumber)) === 'done') return;
      if (!stop) t = setTimeout(ask, RECHECK_MS);
    };
    const untilEnd = holdUntil ? Date.parse(holdUntil) - Date.now() : RECHECK_MS;
    t = setTimeout(ask, Math.max(0, Math.min(RECHECK_MS, untilEnd)));
    return () => { stop = true; clearTimeout(t); };
  }, [openNumber, holdUntil, phase, settleOpen]);

  const lines = bagLines(bag);
  const buy = lines.filter((l) => l.buyable && l.price != null);
  const totals = bagTotals(lines);
  const leftOut = lines.length - buy.length;
  const chosen = addr.list.find((a) => a.id === sel) || null;
  const bagReady = bag.status === 'ready' && bag.owner === 'account' && !lines.some((l) => l.state === 'unknown');

  // The address chosen: the review step comes into view (the form above it may have closed).
  useEffect(() => {
    const h = reviewRef.current;
    if (!done || !h) return;
    h.focus({ preventScroll: true });
    const section = h.closest('section');
    const top = section.getBoundingClientRect().top;
    if (top < 80 || top > window.innerHeight * 0.6) section.scrollIntoView?.({ block: 'start', behavior: prefersReducedMotion() ? 'auto' : 'smooth' });
  }, [done]);

  if (auth === 'unknown' || (signedIn && cfg === 'loading')) return <div className="boot" aria-busy="true" aria-label="Loading"><span className="dot" /></div>;

  if (!signedIn) {
    return (
      <div className="wrap narrow co-page">
        <Head />
        <div className="card stack co-gate">
          <span className="ico-wrap"><Icon name="lock" /></span>
          <h2>Sign in to check out</h2>
          <p>Your bag stays as it is. Sign in with your mobile number and a code by SMS, and you come straight back here.</p>
          <div className="row-wrap" style={{ justifyContent: 'center' }}>
            <Link className="btn btn-primary btn-lg" to="/sign-in?next=%2Fcheckout">Sign in</Link>
            <Link className="btn btn-lg" to="/bag">Back to the bag</Link>
          </div>
        </div>
      </div>
    );
  }

  if (!paymentsOn) {
    return (
      <div className="wrap narrow co-page">
        <Head />
        <EmptyState icon="clock" title="Online payment isn't open yet" text="Send us your bag on WhatsApp and we reply with the payment details. Your bag is saved in your account.">
          <div className="row-wrap" style={{ justifyContent: 'center' }}>
            <button type="button" className="btn btn-wa" onClick={() => { navigate('/bag'); openWhatsApp(); }}><Icon name="whatsapp" size="sm" />Send bag on WhatsApp</button>
            <Link className="btn" to="/bag">Open the bag</Link>
          </div>
        </EmptyState>
      </div>
    );
  }

  const checking = (bag.status === 'checking' || bag.status === 'idle') && !buy.length;
  if (!checking && !buy.length && bag.status !== 'error') {
    return (
      <div className="wrap narrow co-page">
        <Head />
        <div className="co-notes">{['changed', 'expired', 'earlier'].includes(notice?.kind) ? <Notice notice={notice} /> : null}</div>
        <EmptyState icon="bag" title={lines.length ? 'Your bag has nothing that can be bought now' : 'Your bag is empty'} text={lines.length ? 'The sarees in it sold or left the website. Have a look at what\'s new.' : 'Every piece is handwoven in Mangalagiri.'}>
          <div className="row-wrap" style={{ justifyContent: 'center' }}>
            <Link className="btn btn-primary" to="/bag">Open the bag</Link>
            <Link className="btn" to="/shop?sort=new">New in</Link>
          </div>
        </EmptyState>
      </div>
    );
  }

  async function onPay() {
    if (!online) { setNotice({ kind: 'offline' }); return; }
    if (!chosen || !done || phase !== 'idle') return;
    setNotice(null);
    try {
      const r = await payment.pay(() => shopApi.checkout(chosen.id, expectOf(buy, totals.amount)));
      setOrder(r.order);
    } catch (err) {
      if (err.code === 'BAG_CHANGED' || err.code === 'BAG_EMPTY') {
        takeServerBag(err.details?.bag);
        // The open checkout may have been paid meanwhile (in a UPI app; its sarees then left the
        // bag): say that, never "something changed, nothing was charged".
        const open = order?.number || rememberedCheckout();
        const paid = open ? await shopApi.order(open).then((r) => (PAID_LIKE.includes(r.order.status) ? r.order : null), () => null) : null;
        setOrder(null);
        if (paid) { rememberCheckout(null); setNotice({ kind: 'earlier', order: paid }); return; }
        setNotice({ kind: 'changed' });
      } else if (err.code === 'ORDER_PAID') {
        // Paid a moment ago (another tab, a UPI app): no second payment is opened.
        rememberCheckout(null);
        setOrder(null);
        refreshBag();
        setNotice({ kind: 'earlier', order: err.details?.order || { number: order?.number, status: 'paid' } });
      } else if (err.code === 'ORDER_TOO_LARGE') {
        setOrder(null);
        setNotice({ kind: 'tooLarge', message: err.message });
      } else if (err.code === 'ADDRESS_INVALID') {
        const a = addr.list.find((x) => x.id === (err.details?.addressId || chosen.id)) || chosen;
        setDone(false);
        setForm({ mode: 'fix', address: a, problem: a.problem || { field: err.details?.field, message: err.message } });
      } else if (err.code === 'ADDRESS_NOT_FOUND') {
        setDone(false);
        loadAddresses();
        setNotice({ kind: 'error', message: 'This address was removed. Choose another one.' });
      } else if (err.code === 'OFFLINE') {
        setNotice({ kind: 'offline' });
      } else {
        setNotice({ kind: 'error', message: err.message });
      }
    }
  }

  async function changeBag() {
    if (order) await shopApi.cancelCheckout(order.number).catch(() => {});
    rememberCheckout(null);
    navigate('/bag');
  }

  function checkAgain() {
    setNotice(null);
    refreshBag();
  }

  function deliverHere() {
    if (!chosen) return;
    if (chosen.problem) { setForm({ mode: 'fix', address: chosen, problem: chosen.problem }); return; }
    keepAddress(chosen.id);
    setDone(true);
  }

  function saved(r, fixedId) {
    setAddr({ status: 'ready', list: r.addresses, max: r.max, error: null });
    const id = r.address?.id || fixedId;
    if (id) { setSel(id); keepAddress(id); }
    setForm(null);
    setDone(true);
  }

  // Razorpay's limit for one payment (the server's setting): a bigger bag orders on WhatsApp.
  const maxAmount = config.payments?.maxAmount;
  const tooLarge = !!maxAmount && totals.amount > maxAmount;
  const canPay = done && !!chosen && !chosen.problem && bagReady && buy.length > 0 && online && phase === 'idle' && !tooLarge;
  const payLabel = `Pay ${rs(totals.amount)}`;
  const full = addr.list.length >= addr.max;

  /* ---------- Step 1: the address ---------- */
  let step1;
  if (done && chosen && !form) {
    step1 = (
      <div className="co-done">
        <div className="ad-card static"><AddressBlock a={chosen} /></div>
        <button type="button" className="link small" onClick={() => { setDone(false); requestAnimationFrame(() => document.querySelector('input[name="co-addr"]:checked, input[name="co-addr"]')?.focus()); }}>Change</button>
      </div>
    );
  } else if (form) {
    step1 = (
      <AddressForm
        inline
        address={form.mode === 'fix' ? form.address : null}
        problem={form.mode === 'fix' ? form.problem : null}
        customer={customer || {}}
        isFirst={!addr.list.length}
        saveText="Save and deliver here"
        onClose={addr.list.length ? () => setForm(null) : undefined}
        onSaved={(r) => saved(r, form.mode === 'fix' ? form.address.id : null)}
      />
    );
  } else if (addr.status === 'loading') {
    step1 = <><Skeleton h={110} /><Skeleton h={44} style={{ width: 200 }} /></>;
  } else if (addr.status === 'error') {
    step1 = <Alert tone="bad" title="Your addresses didn't load" actions={<Button size="sm" onClick={loadAddresses}>Try again</Button>}>{addr.error?.message}</Alert>;
  } else {
    step1 = (
      <>
        <fieldset className="ad-list">
          <legend className="sr-only">Delivery address</legend>
          {addr.list.map((a) => (
            <label key={a.id} className={`ad-card${a.id === sel ? ' is-on' : ''}${a.problem ? ' is-bad' : ''}`}>
              <input type="radio" name="co-addr" value={a.id} checked={a.id === sel} onChange={() => setSel(a.id)} />
              <span className="ad-body">
                <AddressBlock a={a} />
                {a.problem ? <span className="ad-warn"><Icon name="alert" size="sm" />Needs checking before use</span> : null}
              </span>
            </label>
          ))}
        </fieldset>
        {full ? <p className="muted small">You have {addr.max} saved addresses, the most we keep. Delete one in My account to add another.</p> : null}
        <div className="row-wrap co-actions">
          <Button kind="ghost" icon="plus" disabled={full} onClick={() => setForm({ mode: 'new' })}>Add a new address</Button>
          <Button kind="primary" size="lg" disabled={!chosen} onClick={deliverHere}>Deliver here</Button>
        </div>
      </>
    );
  }

  return (
    <div className="wrap co-page">
      <Head />
      <div className="co-notes">
        <TestPayNote />
        <InAppNote app={app} />
        {!online && !notice ? <Alert tone="warn" icon="wifioff" title="You're offline">You can look over your order. Pay works when you&apos;re back online.</Alert> : null}
        {bag.status === 'error' && online ? <Alert tone="bad" title="We couldn't check your bag just now" actions={<Button size="sm" icon="refresh" onClick={() => refreshBag()}>Try again</Button>}>Prices and stock are checked before you pay.</Alert> : null}
        <Notice notice={notice} ended={payment.ended} order={order} onPay={onPay} onChangeBag={changeBag} onCheckAgain={checkAgain} app={app} />
      </div>
      <div className="co-grid">
        <div className="co-main">
          <section className={`co-step card${done && !form ? ' is-done' : ''}`} aria-labelledby="co-ad">
            <div className="co-head">
              <span className="co-n">{done && !form ? <Icon name="check" size="sm" /> : '1'}</span>
              <h2 id="co-ad">Delivery address</h2>
            </div>
            {step1}
          </section>
          <section className={`co-step card${done && !form ? '' : ' is-later'}`} aria-labelledby="co-rv">
            <div className="co-head">
              <span className="co-n">2</span>
              <h2 id="co-rv" ref={reviewRef} tabIndex={-1}>Review and pay</h2>
              {done && !form ? <button type="button" className="link small" onClick={changeBag}>Change my bag</button> : null}
            </div>
            {done && !form ? (
              <>
                {checking ? <Skeleton h={90} /> : <SareeLines lines={buy} />}
                {leftOut ? <p className="co-left-out">{plural(leftOut, 'saree in your bag can\'t', 'sarees in your bag can\'t')} be bought now and {leftOut === 1 ? 'is' : 'are'} left out.</p> : null}
              </>
            ) : <p className="muted small">After you choose the address.</p>}
          </section>
        </div>
        <aside className="sum card co-sum" aria-labelledby="co-sum-h">
          <h2 id="co-sum-h">Order summary</h2>
          <div className="sumrow"><span>Subtotal ({pieces(totals.pieces)})</span><span className="v">{rs(totals.amount)}</span></div>
          <div className="sumrow"><span>Delivery</span><span className="free">Free</span></div>
          <div className="sumrow total"><span>Total</span><span className="v">{rs(totals.amount)}</span></div>
          <p className="tax">{gstText(totals.amount, done ? chosen?.state : null, config.gst)}</p>
          {order && phase !== 'confirming' ? <HoldLine until={order.holdUntil} /> : null}
          {tooLarge ? (
            <div className="too-large" role="status">
              <p>Orders above {rs(maxAmount)} can&apos;t be paid online in one go. Order on WhatsApp and we&apos;ll help you pay, or remove a saree.</p>
              <button type="button" className="btn btn-wa btn-block" onClick={openWhatsApp}><Icon name="whatsapp" size="sm" />Order on WhatsApp</button>
            </div>
          ) : null}
          <div className="acts">
            <Button kind="primary" size="lg" block icon="lock" disabled={!canPay} loading={phase === 'starting'} onClick={onPay}>{payLabel}</Button>
            <p className="soon pay-methods"><Icon name="shield" size="sm" />Secure payment by Razorpay · UPI, cards, net banking, wallets</p>
          </div>
          <p className="muted small agree">By paying you agree to our <Link className="link" to="/terms">Terms</Link>, <Link className="link" to="/shipping">Shipping</Link> and <Link className="link" to="/refunds">Cancellation and refunds</Link> policies.</p>
          <div className="notes">
            <div><Icon name="truck" size="sm" />Free delivery across India by DTDC</div>
            <div><Icon name="clock" size="sm" />Your sarees are held for you for 15 minutes when you press Pay.</div>
            <div><Icon name="thread" size="sm" />Handwoven in Mangalagiri</div>
          </div>
        </aside>
      </div>
      <div className="pay-bar">
        <span className="t"><b>{rs(totals.amount)}</b><span>{pieces(totals.pieces)} · free delivery</span></span>
        <Button kind="primary" icon="lock" disabled={!canPay} loading={phase === 'starting'} onClick={onPay} aria-label={payLabel}>Pay</Button>
      </div>
      {phase === 'confirming' ? <ConfirmingPayment /> : null}
    </div>
  );
}
