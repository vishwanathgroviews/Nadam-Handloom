// One order (/order/NH…). Only the customer's own orders.
// - Just paid (W6 6.6 A): "Order confirmed" with the order number, what happens next, the sarees,
//   the address and the payment; or the ending of that payment (confirming with the bank,
//   refunded). While a payment is being confirmed, the page asks the server again by itself.
// - Any later visit, from My orders or a notification (W7 7.3 A): the order's own page, with
//   its status, the progress line, tracking, Download invoice, Buy again and help; and, for an
//   order still being paid for, Pay.
// - A checkout that ended without a payment: what happened, nothing charged.
import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import Icon from '../../components/Icon.jsx';
import Alert from '../../components/Alert.jsx';
import Button from '../../components/Button.jsx';
import { BackRow, Crumbs, EmptyState, Skeleton } from '../../components/bits.jsx';
import { AddressBlock, ConfirmingPayment, SareeLines } from '../checkout/parts.jsx';
import { clock, gstText } from '../checkout/format.js';
import { rememberCheckout, usePayment } from '../checkout/usePayment.js';
import { shopApi } from '../../api/shop.js';
import { refresh as refreshBag } from '../../bag/store.js';
import { markSeen } from '../../orders/seen.js';
import { KEPT, placedText } from '../../orders/status.js';
import { Progress, StatusBadge, Tracking } from '../../orders/parts.jsx';
import { useOrderActions } from '../../orders/actions.js';
import { whatsAppLink } from '../../bag/message.js';
import { useAuth } from '../../auth/useAuth.js';
import { useConfig } from '../../config/useConfig.js';
import { useTitle } from '../../utils/useTitle.js';
import { dayMonthYear, firstName, longDate } from '../../utils/format.js';
import { pieces, rs } from '../../utils/money.js';
import '../../theme/checkout.css';
import '../../theme/orders.css';

const LOCAL_CONFIRM_MS = 10 * 60_000; // paid in the window, our server not reached: keep asking
const TITLES = {
  paid: 'Order confirmed', shipped: 'Order shipped', delivered: 'Order delivered', confirming: 'Confirming payment',
  awaiting_payment: 'Payment not completed', hold_ended: 'Checkout ended', refunded: 'Order not kept', cancelled: 'Checkout cancelled',
};
// Shown as the moment's ending (W6) on every visit; the rest only right after paying.
const ALWAYS_ENDING = new Set(['confirming', 'hold_ended', 'cancelled']);
const JUST_PAID_ENDING = new Set(['paid', 'shipped', 'delivered', 'refunded']);

function Next({ order }) {
  const s = order.status;
  const shipped = s === 'shipped' || s === 'delivered';
  const steps = [
    ['check', 'Paid', order.payment?.paidAt ? `${clock(order.payment.paidAt)}, ${longDate(order.payment.paidAt)}` : 'Just now', true],
    ['box', 'Packed', 'Within 2 working days', shipped],
    ['truck', 'Shipped by DTDC', order.shipping?.trackingNumber ? `Tracking ${order.shipping.trackingNumber}` : 'Tracking number in My orders', shipped],
    ['home', 'Delivered', 'Usually 3 to 7 days', s === 'delivered'],
  ];
  return (
    <ol className="ord-next" aria-label="What happens next">
      {steps.map(([icon, b, small, on]) => (
        <li key={b} className={on ? 'on' : ''}><span><Icon name={on ? 'check' : icon} size="sm" /></span><b>{b}</b><small>{small}</small></li>
      ))}
    </ol>
  );
}

// The payment, and the invoice (W7: downloaded here once it is made).
function PaymentPart({ order, actions }) {
  if (order.status === 'awaiting_payment') return <p className="muted">Not paid yet. Nothing was charged.</p>;
  if (order.status === 'refunded') return <p className="muted">{rs(order.refund?.amount ?? order.total)} {order.refund?.status === 'processed' ? 'was refunded' : 'is being refunded'} to the account you paid from.</p>;
  if (!order.payment) return null;
  const inv = order.invoice;
  return (
    <>
      <p className="ord-pay"><Icon name="check" size="sm" /><span>Paid {rs(order.total)} by {order.payment.methodText} (Razorpay){order.payment.paidAt ? ` · ${clock(order.payment.paidAt)}, ${longDate(order.payment.paidAt)}` : ''}</span></p>
      {inv?.ready ? (
        <p className="muted small">GST invoice {inv.number}{inv.cancelled ? ' (stamped CANCELLED)' : ''}. {actions ? <button type="button" className="link small" onClick={actions.invoice} disabled={actions.busy === 'invoice'}>Download it</button> : null}</p>
      ) : <p className="muted small">Your GST invoice is being made. It will be here in a few minutes.</p>}
    </>
  );
}

function Details({ order, gst, actions }) {
  const paid = !!order.payment;
  return (
    <div className="ord-grid">
      <section className="card" aria-labelledby="ord-sarees">
        <h2 className="h-sm" id="ord-sarees">Your sarees</h2>
        <SareeLines lines={order.lines} />
        <div className="sumrow total"><span>{paid ? 'Total paid' : 'Total'}</span><span className="v">{rs(order.total)}</span></div>
        <p className="tax">{gstText(order.total, order.address?.state, gst)} · Free delivery</p>
      </section>
      <section className="card" aria-labelledby="ord-to">
        <h2 className="h-sm" id="ord-to">{order.status === 'delivered' ? 'Delivered to' : ['cancelled_paid', 'refunded'].includes(order.status) ? 'Delivery address' : 'Delivering to'}</h2>
        <div className="ad-card static"><AddressBlock a={order.address} showLabel={false} /></div>
        <p className="muted small" style={{ marginTop: '.5rem' }}>The address saved with this order.</p>
        <h2 className="h-sm" style={{ marginTop: '1.2rem' }}>Payment</h2>
        <PaymentPart order={order} actions={actions} />
      </section>
    </div>
  );
}

// W7 7.3 A: the order's own page (any visit after paying, or while still paying).
function OrderView({ order, config, pay }) {
  const actions = useOrderActions(order);
  const wa = (text) => whatsAppLink(config.store.whatsapp, text);
  const s = order.status;
  let note = null;
  if (s === 'awaiting_payment') {
    note = (
      <>
        <Alert tone="warn" icon="clock" title="Waiting for payment" actions={<><Button size="sm" kind="primary" icon="lock" loading={pay.busy} disabled={pay.disabled} onClick={pay.payNow}>Pay {rs(order.total)}</Button><Button size="sm" onClick={pay.changeBag}>Change my bag</Button></>}>
          Your sarees are held for you until <b>{clock(order.holdUntil)}</b>. Nothing was charged yet.
        </Alert>
        {pay.note ? <Alert tone="bad">{pay.note}</Alert> : null}
        {pay.ended?.kind === 'failed' ? <Alert tone="bad" title="Payment didn't go through. Nothing was taken.">{pay.ended.reason}</Alert> : null}
        {pay.ended?.kind === 'closed' ? <Alert title="Payment not completed">Your sarees are still held until {clock(order.holdUntil)}. Press Pay when you&apos;re ready.</Alert> : null}
        {pay.ended?.kind === 'script' ? <Alert tone="bad" title="The payment window didn't open">Check your connection and press Pay again. Nothing was charged.</Alert> : null}
      </>
    );
  } else if (s === 'refunded') {
    const amount = rs(order.refund?.amount ?? order.total);
    const reason = order.refund?.reason ? `${order.refund.reason.replace(/\.?$/, '.')} ` : '';
    note = (
      <Alert tone="ok" icon="refresh" title={order.refund?.status === 'processed' ? `Your ${amount} was refunded` : `Your ${amount} is being refunded`} actions={<a className="btn btn-sm btn-wa" href={wa(`Hello Nandam Handlooms, my order ${order.number} was refunded. Do you have a similar saree?`)} target="_blank" rel="noopener noreferrer"><Icon name="whatsapp" size="sm" />Ask for a similar saree</a>}>
        {reason}It goes back to the same account you paid from, usually in 5 to 7 working days.
      </Alert>
    );
  } else if (s === 'cancelled_paid') {
    const done = order.cancelled?.refundedAt;
    note = (
      <Alert tone={done ? 'ok' : 'warn'} icon="refresh" title={done ? `Cancelled by the shop: your ${rs(order.total)} was refunded` : `Cancelled by the shop: ${rs(order.total)} is being refunded`} actions={<a className="btn btn-sm btn-wa" href={wa(`Hello Nandam Handlooms, about my cancelled order ${order.number}.`)} target="_blank" rel="noopener noreferrer"><Icon name="whatsapp" size="sm" />Ask about it</a>}>
        {done
          ? <>Refunded on {dayMonthYear(done)}, to the same account you paid from. It can take 5 to 7 working days to show.</>
          : <>We&apos;re sorry: we couldn&apos;t send this order. The money goes back to the same account you paid from, usually within 5 to 7 working days.</>}
      </Alert>
    );
  }
  const kept = KEPT.has(s);
  return (
    <div className="wrap ord-page">
      <div className="page-head">
        <Crumbs items={[['Home', '/'], ['My account', '/account'], ['My orders', '/account/orders'], [`Order ${order.number}`]]} />
        <div className="ord-head">
          <div>
            <h1>Order <span className="tnum">{order.number}</span></h1>
            <p className="muted">Placed {placedText(order)}{order.oldWebsite ? ' on our old website' : ''} · {pieces(order.pieces)}</p>
          </div>
          <StatusBadge order={order} />
        </div>
      </div>
      <div className="ord-view">
        {note}
        {kept ? <Progress order={order} /> : null}
        <Tracking order={order} />
        <div className="oacts">
          {order.invoice?.ready ? <Button icon="download" loading={actions.busy === 'invoice'} onClick={actions.invoice}>Download invoice</Button> : null}
          {order.canBuyAgain ? <Button icon="bag" loading={actions.busy === 'buy'} onClick={actions.buy}>Buy again</Button> : null}
          <a className="btn btn-wa" href={wa(`Hello Nandam Handlooms, about my order ${order.number}.`)} target="_blank" rel="noopener noreferrer"><Icon name="whatsapp" size="sm" />Help on WhatsApp</a>
        </div>
        {s === 'paid' || s === 'awaiting_payment'
          ? <p className="muted small ord-help">Need to cancel or change something? <a className="link" href={wa(`Hello Nandam Handlooms, I'd like to cancel or change my order ${order.number}.`)} target="_blank" rel="noopener noreferrer">WhatsApp us</a> with your order number.</p>
          : null}
        <Details order={order} gst={config.gst} actions={actions} />
      </div>
    </div>
  );
}

export default function OrderPage() {
  const { number = '' } = useParams();
  const { state: nav, key: navKey } = useLocation();
  const navigate = useNavigate();
  const { customer } = useAuth();
  const { config } = useConfig();
  const payment = usePayment();
  const [data, setData] = useState({ status: 'loading', order: null, error: null });
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState(null);
  const startedAt = useRef(0);
  const lastStatus = useRef(null);
  const paidHere = !!nav?.paid;
  const valid = /^NH\d{8}$/.test(number);

  const load = useCallback(async (signal) => {
    try {
      const r = await shopApi.order(number, { signal });
      // Just became paid: its sarees left the bag on the server; the bag catches up. (Outside the
      // state update: that runs while React draws, and the bag button would change mid-draw.)
      if (lastStatus.current !== 'paid' && r.order.status === 'paid') refreshBag();
      lastStatus.current = r.order.status;
      setData({ status: 'ready', order: r.order, error: null });
    } catch (error) {
      if (signal?.aborted) return;
      // Already showing the order: keep it, but as a new state, so the checks that wait on it
      // (confirming with the bank) carry on after a failed ask (a phone briefly offline).
      setData((d) => (d.order ? { ...d, failedAt: Date.now() } : { status: 'error', order: null, error }));
    }
  }, [number]);

  useEffect(() => {
    startedAt.current = Date.now();
    if (!valid) return undefined;
    const ac = new AbortController();
    load(ac.signal);
    return () => ac.abort();
    // navKey: paid from this page, the payment moves to this same address again (a new entry):
    // asked again, with "just paid".
  }, [load, valid, navKey]);

  const order = data.order;
  // Seen here: the website doesn't announce it again elsewhere.
  useEffect(() => { if (order) markSeen(order.number, order.status); }, [order]);
  // Paid in Razorpay's window but our server hasn't confirmed it yet: "confirming", not "not paid".
  const status = order && order.status === 'awaiting_payment' && paidHere && Date.now() - startedAt.current < LOCAL_CONFIRM_MS ? 'confirming' : order?.status;
  const ending = !!status && (ALWAYS_ENDING.has(status) || (paidHere && JUST_PAID_ENDING.has(status)));
  useTitle(order && !ending ? `Order ${order.number}` : TITLES[status] || 'Your order');

  // Ask again while confirming: every 4 seconds for a minute, then every 15.
  useEffect(() => {
    if (status !== 'confirming') return undefined;
    const ac = new AbortController();
    const ms = Date.now() - startedAt.current < 60_000 ? 4000 : 15_000;
    const t = setTimeout(() => load(ac.signal), ms);
    return () => { clearTimeout(t); ac.abort(); };
  }, [status, load, data]);

  // A checkout's hold ending while this page is open.
  useEffect(() => {
    if (status !== 'awaiting_payment' || !order?.holdUntil) return undefined;
    const t = setTimeout(() => load(), Math.min(Math.max(0, Date.parse(order.holdUntil) - Date.now()) + 1500, 2 ** 31 - 1));
    return () => clearTimeout(t);
  }, [status, order, load]);

  if (!valid || (data.status === 'error' && data.error?.code === 'ORDER_NOT_FOUND')) {
    return (
      <div className="wrap narrow ord-page">
        <BackRow to="/account/orders" />
        <EmptyState icon="info" title="We couldn't find this order" text="Check the link, or sign in with the mobile number you ordered with.">
          <div className="row-wrap" style={{ justifyContent: 'center' }}><Link className="btn btn-primary" to="/account/orders">My orders</Link><Link className="btn" to="/shop">Continue shopping</Link></div>
        </EmptyState>
      </div>
    );
  }
  if (data.status === 'error') {
    return (
      <div className="wrap narrow ord-page">
        <BackRow to="/account/orders" />
        <EmptyState icon="wifioff" title="Your order didn't load" text={data.error?.message}>
          <Button kind="primary" onClick={() => { setData({ status: 'loading', order: null, error: null }); load(); }}>Try again</Button>
        </EmptyState>
      </div>
    );
  }
  if (!order) return <div className="wrap ord-page"><BackRow to="/account/orders" /><div className="ord-hero"><Skeleton h={84} style={{ width: 84, borderRadius: '50%' }} /><Skeleton h={48} style={{ width: 'min(520px, 90%)' }} /></div><Skeleton h={260} /></div>;

  const first = firstName(customer?.fullName);
  const wa = whatsAppLink(config.store.whatsapp, `Hello Nandam Handlooms, about my order ${order.number}.`);

  async function payNow() {
    setNote(null);
    setBusy(true);
    try {
      const r = await payment.pay(() => shopApi.payAgain(order.number));
      if (r?.order) setData({ status: 'ready', order: r.order, error: null }); // the renewed hold
    } catch (err) {
      if (err.code === 'HOLD_ENDED' || err.code === 'ORDER_PAID') load();
      else setNote(err.message);
    } finally {
      setBusy(false);
    }
  }
  async function changeBag() {
    await shopApi.cancelCheckout(order.number).catch(() => {});
    rememberCheckout(null);
    navigate('/bag');
  }
  const confirmingModal = payment.phase === 'confirming' ? <ConfirmingPayment /> : null;

  if (!ending) {
    const pay = { payNow, changeBag, busy: busy || payment.phase === 'starting', disabled: payment.phase !== 'idle', note, ended: payment.ended };
    return <><OrderView order={order} config={config} pay={pay} />{confirmingModal}</>;
  }

  let hero;
  if (status === 'paid' || status === 'shipped' || status === 'delivered') {
    hero = (
      <div className="ord-hero">
        <span className="ord-ic" aria-hidden="true"><Icon name="check" size="lg" /></span>
        <span className="eyebrow">{TITLES[status]}</span>
        <h1>Thank you{first ? `, ${first}` : ''}</h1>
        <p className="lead">Your order <b className="tnum">{order.number}</b> is confirmed and paid: {rs(order.total)} by {order.payment?.methodText || 'online payment'}.</p>
        <Next order={order} />
        {order.refund ? <Alert title={`A second payment of ${rs(order.refund.amount)} is being refunded`}>It goes back to the same account, usually in 5 to 7 working days. You don&apos;t need to do anything.</Alert> : null}
        <div className="row-wrap" style={{ justifyContent: 'center' }}>
          <Link className="btn btn-primary" to="/shop">Continue shopping</Link>
          <Link className="btn" to="/account/orders">My orders</Link>
          <a className="btn" href={wa} target="_blank" rel="noopener noreferrer"><Icon name="whatsapp" size="sm" />Questions? WhatsApp us</a>
        </div>
      </div>
    );
  } else if (status === 'confirming') {
    hero = (
      <div className="ord-hero" role="status">
        <span className="ord-ic slow" aria-hidden="true"><i /></span>
        <h1>Payment received, confirming with your bank</h1>
        <p className="lead">Order <b className="tnum">{order.number}</b> · {rs(order.total)}. Your bank is taking a little longer than usual.</p>
        <p className="muted">You can close this page: we keep checking, and you can open it again from My orders. If the bank doesn&apos;t confirm, the money goes back to you automatically.</p>
        <div className="row-wrap" style={{ justifyContent: 'center' }}>
          <Button kind="primary" icon="refresh" onClick={() => load()}>Check again</Button>
          <Link className="btn" to="/shop">Continue shopping</Link>
        </div>
      </div>
    );
  } else if (status === 'hold_ended') {
    hero = (
      <div className="ord-hero">
        <span className="ord-ic warn" aria-hidden="true"><Icon name="clock" size="lg" /></span>
        <h1>The 15 minutes are over</h1>
        <p className="lead">Your sarees were released, so others could buy them. Nothing was charged for order <b className="tnum">{order.number}</b>.</p>
        <div className="row-wrap" style={{ justifyContent: 'center' }}>
          <Link className="btn btn-primary" to="/checkout">Check my bag again</Link>
          <Link className="btn" to="/shop">Continue shopping</Link>
        </div>
      </div>
    );
  } else if (status === 'refunded') {
    const late = /sold/i.test(order.refund?.reason || '');
    hero = (
      <div className="ord-hero">
        <span className="ord-ic bad" aria-hidden="true"><Icon name="alertc" size="lg" /></span>
        <h1>We couldn&apos;t keep your order</h1>
        <p className="lead">
          {late
            ? <>Your payment for order <b className="tnum">{order.number}</b> arrived after the 15 minutes your sarees were held, and by then a saree had sold at our store.</>
            : <>We couldn&apos;t accept the payment for order <b className="tnum">{order.number}</b>{order.refund?.reason ? `: ${order.refund.reason.charAt(0).toLowerCase()}${order.refund.reason.slice(1)}` : ''}.</>}
        </p>
        <Alert tone="ok" icon="refresh" title={`Your ${rs(order.refund?.amount ?? order.total)} is being refunded`}>To the same account you paid from, usually in 5 to 7 working days. You don&apos;t need to do anything.</Alert>
        <div className="row-wrap" style={{ justifyContent: 'center' }}>
          <Link className="btn btn-primary" to="/shop?sort=new">See what&apos;s new</Link>
          <a className="btn btn-wa" href={whatsAppLink(config.store.whatsapp, `Hello Nandam Handlooms, my order ${order.number} was refunded. Do you have a similar saree?`)} target="_blank" rel="noopener noreferrer"><Icon name="whatsapp" size="sm" />Ask us for a similar saree</a>
        </div>
      </div>
    );
  } else {
    hero = (
      <div className="ord-hero">
        <span className="ord-ic warn" aria-hidden="true"><Icon name="info" size="lg" /></span>
        <h1>This checkout was cancelled</h1>
        <p className="lead">Nothing was charged for order <b className="tnum">{order.number}</b>.</p>
        <div className="row-wrap" style={{ justifyContent: 'center' }}>
          <Link className="btn btn-primary" to="/bag">Open the bag</Link>
          <Link className="btn" to="/shop">Continue shopping</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="wrap ord-page">
      {hero}
      {status === 'cancelled' || status === 'hold_ended' ? null : <ReceiptDetails order={order} gst={config.gst} />}
      {confirmingModal}
    </div>
  );
}

// The details under "Thank you" (W6), with the invoice once it is made (W7).
function ReceiptDetails({ order, gst }) {
  const actions = useOrderActions(order);
  return <Details order={order} gst={gst} actions={order.invoice?.ready ? actions : null} />;
}
