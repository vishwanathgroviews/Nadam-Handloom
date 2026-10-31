// The bag page (/bag, 5.3 A): sarees on the left, the order summary on the right (in view
// while scrolling); one column with a total bar at the bottom on phones. Checked against the
// shop's stock and prices every time it opens (rule 4).
import { useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import Icon from '../../components/Icon.jsx';
import Alert from '../../components/Alert.jsx';
import { Crumbs, EmptyState } from '../../components/bits.jsx';
import SareeCard from '../../components/SareeCard.jsx';
import { Rail, RailNav } from '../../components/Rail.jsx';
import { useRail } from '../../components/useRail.js';
import { useConfirm } from '../../components/Modal.jsx';
import { useToast } from '../../components/Toasts.jsx';
import BagLine from './BagLine.jsx';
import { useBag, bagLines, bagTotals } from '../../bag/useBag.js';
import { useBagActions } from '../../bag/useBagActions.js';
import { clear, dismissNotice, openWhatsApp, refresh, setSent } from '../../bag/store.js';
import { readRecent } from '../../data/recent.js';
import { useAuth } from '../../auth/useAuth.js';
import { usePaymentsOn } from '../../payments/usePaymentsOn.js';
import { useOnline } from '../../utils/useOnline.js';
import { useTitle } from '../../utils/useTitle.js';
import { pieces, rs } from '../../utils/money.js';
import TestPayNote from '../../payments/TestPayNote.jsx';

const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;

function changesText(c) {
  return [
    c.soldOut ? `${c.soldOut} sold out` : null,
    c.unavailable ? `${c.unavailable} no longer on the website` : null,
    c.fewer ? `${c.fewer} with fewer pieces left` : null,
    c.priceChanged ? `${c.priceChanged} with a new price` : null,
  ].filter(Boolean).join(' · ');
}

function Notice({ notice }) {
  if (!notice) return null;
  const close = <button type="button" className="btn btn-sm btn-ghost" onClick={dismissNotice}>OK</button>;
  if (notice.kind === 'old') {
    return <Alert tone="ok" icon="refresh" title={`We brought back ${plural(notice.count, 'saree', 'sarees')} from your earlier visit`} actions={close}>They were in your bag on our old website. Any that have sold since are marked below.</Alert>;
  }
  if (notice.kind === 'joined') {
    const bits = [
      notice.fromAccount ? `${plural(notice.fromAccount, 'saree', 'sarees')} saved in your account ${notice.fromAccount === 1 ? 'was' : 'were'} added` : null,
      notice.moreOf ? `${plural(notice.moreOf, 'saree now has', 'sarees now have')} the larger number of pieces you chose before` : null,
      notice.skipped ? `${plural(notice.skipped, 'saree', 'sarees')} that can't be bought now ${notice.skipped === 1 ? 'was' : 'were'} left out` : null,
    ].filter(Boolean);
    const title = notice.fromAccount || notice.moreOf ? `Welcome back${notice.firstName ? `, ${notice.firstName}` : ''}. Your bags are joined` : 'Your bag is saved in your account';
    return <Alert tone="ok" title={title} actions={close}>{bits.join('; ')}. Your bag is saved in your account, so it shows on your other devices too.</Alert>;
  }
  if (notice.kind === 'signedOut') {
    return <Alert tone="info" icon="logout" title="You're signed out, so your bag was removed from this browser" actions={<><Link className="btn btn-sm btn-primary" to="/sign-in?next=/bag">Sign in</Link>{close}</>}>It is saved in your account. Sign in to see it again.</Alert>;
  }
  if (notice.kind === 'dropped') {
    return <Alert tone="info" title={`${plural(notice.count, 'saree is', 'sarees are')} no longer available and ${notice.count === 1 ? 'was' : 'were'} taken out`} actions={close}>{null}</Alert>;
  }
  return null;
}

function Recent({ skip }) {
  const rail = useRail();
  const cards = useMemo(() => readRecent().filter((c) => !skip.has(c.slug) && c.available > 0).slice(0, 10), [skip]);
  if (!cards.length) return null;
  return (
    <section className="section tight" aria-labelledby="bag-recent">
      <div className="sec-head">
        <div><span className="eyebrow">Your browsing</span><h2 id="bag-recent">Recently viewed</h2></div>
        <RailNav rail={rail} label="Recently viewed" />
      </div>
      <Rail rail={rail} label="Recently viewed" className="four">
        {cards.map((c, i) => <SareeCard key={c.slug} card={c} index={i} />)}
      </Rail>
    </section>
  );
}

export default function BagPage() {
  useTitle('Your bag');
  const bag = useBag();
  const { status: auth } = useAuth();
  const online = useOnline();
  const confirm = useConfirm();
  const toast = useToast();
  const actions = useBagActions();
  const paymentsOn = usePaymentsOn(); // W6: Checkout; otherwise WhatsApp as before
  useEffect(() => { refresh(); }, []);

  const lines = bagLines(bag);
  const totals = bagTotals(lines);
  const skip = useMemo(() => new Set(bag.items.map((i) => i.slug)), [bag.items]);
  const changed = changesText(totals.changes);
  const offline = !online || bag.error?.code === 'OFFLINE';
  const failed = !offline && bag.status === 'error';
  const canSend = online && totals.pieces > 0;

  async function clearAll() {
    const ok = await confirm({ title: 'Clear your bag?', text: `This removes ${plural(lines.length, 'saree', 'sarees')} from your bag${auth === 'signedIn' ? ', here and in your account' : ''}.`, ok: 'Clear the bag', cancel: 'Keep them', danger: true, icon: 'trash', tone: 'warn' });
    if (!ok) return;
    try {
      await clear();
      toast('Your bag is empty now');
    } catch (err) {
      toast(err.message, { tone: 'bad' });
    }
  }

  const notes = (
    <>
      {offline ? <Alert tone="warn" icon="wifioff" title="You're offline">This is your bag as saved on this device. We'll check prices and stock when you're back online.</Alert> : null}
      {failed ? (
        <Alert tone="bad" title="We couldn't check your bag just now" actions={<button type="button" className="btn btn-sm" onClick={() => refresh()}><Icon name="refresh" size="sm" />Try again</button>}>
          Your sarees are safe here. Prices and stock will update once we can check.
        </Alert>
      ) : null}
      <Notice notice={bag.notice} />
      {changed ? <Alert tone="warn" title="Some sarees changed since you added them">{changed}. The total uses today&apos;s prices and stock.</Alert> : null}
      {bag.sent && lines.length ? (
        <Alert tone="info" icon="whatsapp" title="Sent on WhatsApp?" actions={<><button type="button" className="btn btn-sm" onClick={clearAll}>Clear the bag</button><button type="button" className="btn btn-sm btn-ghost" onClick={() => setSent(false)}>Keep it</button></>}>
          We reply with the payment details. Once your order is confirmed, you can clear the bag.
        </Alert>
      ) : null}
    </>
  );

  if (!lines.length) {
    return (
      <div className="wrap">
        <div className="page-head"><Crumbs items={[['Home', '/'], ['Your bag']]} /><h1>Your bag</h1></div>
        <div className="stack-sm">{notes}</div>
        <EmptyState icon="bag" title="Your bag is empty" text="Every piece is handwoven in Mangalagiri. Start with what's new, or a set for the family.">
          <div className="row-wrap" style={{ justifyContent: 'center' }}>
            <Link className="btn btn-primary" to="/shop?sort=new">New in</Link>
            <Link className="btn" to="/collections">All collections</Link>
            <Link className="btn" to="/shop?sets=1">Sets for the family</Link>
          </div>
        </EmptyState>
        <Recent skip={skip} />
        <div style={{ height: 'clamp(32px, 5vw, 64px)' }} />
      </div>
    );
  }

  const checking = bag.status === 'checking'
    ? <span className="checking" role="status"><i />Checking prices and stock…</span>
    : offline ? <span className="checking">Last checked before you went offline</span>
      : bag.status === 'ready' ? <span className="checking"><Icon name="check" size="sm" />Prices and stock checked just now</span> : <span />;

  return (
    <div className="wrap bag-page">
      <div className="page-head">
        <Crumbs items={[['Home', '/'], ['Your bag']]} />
        <h1>Your bag</h1>
        <p className="muted">{pieces(totals.pieces)}{totals.out ? ` · ${plural(totals.out, 'saree', 'sarees')} can't be bought now` : ''}</p>
      </div>
      <div className="bagp">
        <div>
          <div className="notes-top">{notes}</div>
          <div className="lead-row">{checking}<Link className="link small" to="/shop">Continue shopping</Link></div>
          <div className="blines">
            {lines.map((l) => <BagLine key={l.slug} line={l} onQuantity={actions.quantity} onRemove={actions.remove} busy={actions.busy} />)}
          </div>
        </div>
        <aside className="sum card" aria-labelledby="sum-title">
          <h2 id="sum-title">Order summary</h2>
          <div className="sumrow"><span>Subtotal ({pieces(totals.pieces)})</span><span className="v">{rs(totals.amount)}</span></div>
          <div className="sumrow"><span>Delivery</span><span className="free">Free</span></div>
          <div className="sumrow total"><span>Total</span><span className="v">{rs(totals.amount)}</span></div>
          <p className="tax">Includes all taxes</p>
          {totals.out ? <p className="left-out">{plural(totals.out, 'saree that can\'t be bought now is', 'sarees that can\'t be bought now are')} not counted.</p> : null}
          {paymentsOn ? (
            <div className="acts">
              {totals.pieces > 0
                ? <Link className="btn btn-primary btn-lg btn-block" to="/checkout"><Icon name="lock" size="sm" />Checkout</Link>
                : <button type="button" className="btn btn-primary btn-lg btn-block" disabled><Icon name="lock" size="sm" />Checkout</button>}
              <p className="soon pay-methods"><Icon name="shield" size="sm" />Secure payment by Razorpay · UPI, cards, net banking, wallets</p>
              <TestPayNote short />
              <button type="button" className="wa-link" onClick={openWhatsApp} disabled={!canSend}><Icon name="whatsapp" size="sm" />Order on WhatsApp instead</button>
            </div>
          ) : (
            <div className="acts">
              <button type="button" className="btn btn-wa btn-lg btn-block" onClick={openWhatsApp} disabled={!canSend}>
                <Icon name="whatsapp" size="sm" />Send bag on WhatsApp
              </button>
              <p className="soon">Online payment is coming soon. We reply on WhatsApp with the payment details.</p>
              <Link className="btn btn-block" to="/shop">Continue shopping</Link>
            </div>
          )}
          <div className="notes">
            <div><Icon name="truck" size="sm" />Free delivery across India</div>
            <div><Icon name="clock" size="sm" />{paymentsOn ? 'Sarees are held for you for 15 minutes once you press Pay. Until then our store sells them too.' : <>Sarees in your bag aren&apos;t held for you: our store sells them too.</>}</div>
            <div><Icon name="thread" size="sm" />Handwoven in Mangalagiri</div>
            {auth === 'signedIn' ? <div><Icon name="user" size="sm" />Saved in your account</div> : null}
            {!bag.storable ? (
              <div className="warn-note"><Icon name="alert" size="sm" /><span>Your browser isn&apos;t saving your bag (private browsing?). <Link className="link" to="/sign-in?next=/bag">Sign in</Link> to keep it.</span></div>
            ) : null}
          </div>
        </aside>
      </div>
      <Recent skip={skip} />
      <div style={{ height: 'clamp(32px, 5vw, 64px)' }} />
      <div className="bag-bar">
        <span className="t"><b>{rs(totals.amount)}</b><span>{pieces(totals.pieces)} · free delivery</span></span>
        {paymentsOn
          ? (totals.pieces > 0 ? <Link className="btn btn-primary" to="/checkout"><Icon name="lock" size="sm" />Checkout</Link> : <button type="button" className="btn btn-primary" disabled>Checkout</button>)
          : <button type="button" className="btn btn-wa" onClick={openWhatsApp} disabled={!canSend}><Icon name="whatsapp" size="sm" />Send</button>}
      </div>
    </div>
  );
}
