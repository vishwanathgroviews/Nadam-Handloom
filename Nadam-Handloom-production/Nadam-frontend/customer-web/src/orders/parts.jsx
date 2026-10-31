// The parts My orders (W7) and one order's page share: the status badge, an order's photos, an
// order's card (7.2 A), the progress line and the tracking card (7.4 A).
import { useState } from 'react';
import { Link } from 'react-router-dom';
import Icon from '../components/Icon.jsx';
import Button from '../components/Button.jsx';
import { useToast } from '../components/Toasts.jsx';
import { dayMonthYear } from '../utils/format.js';
import { pieces, rs } from '../utils/money.js';
import { useOrderActions } from './actions.js';
import { KEPT, amountLabel, badgeTone, nextLine, orderTitle, placedText, statusText, steps } from './status.js';

export function StatusBadge({ order }) {
  return <span className={`ost ${badgeTone(order.status)}`}><i aria-hidden="true" />{statusText(order)}</span>;
}

const photoUrl = (p) => (typeof p === 'string' ? p : p?.url) || null;
function Photo({ photo }) {
  const [broken, setBroken] = useState(false);
  const url = photoUrl(photo);
  if (!url || broken) return <span className="ph" aria-hidden="true" />;
  return <img src={url} alt="" loading="lazy" decoding="async" onError={() => setBroken(true)} />;
}
export function Photos({ photos = [], more = 0, max = 4 }) {
  const shown = photos.slice(0, max);
  const extra = more + Math.max(0, photos.length - shown.length);
  return (
    <div className="oc-photos" aria-hidden="true">
      {shown.length ? shown.map((p, i) => <Photo key={`${photoUrl(p)}-${i}`} photo={p} />) : <span className="ph" />}
      {extra > 0 ? <span className="more">+{extra}</span> : null}
    </div>
  );
}

// 7.2 A: one order in the list.
export function OrderCard({ order: o, index = 0 }) {
  const { busy, invoice, buy } = useOrderActions(o);
  const [icon, next] = nextLine(o);
  const id = `oc-${o.number}`;
  return (
    <article className="ocard" style={{ '--i': index }} aria-labelledby={id}>
      <div className="oc-top">
        <div className="oc-no">
          <h2 className="oc-title" id={id}>Order <span className="tnum">{o.number}</span></h2>
          <small>{placedText(o)}{o.oldWebsite ? <> · <span className="from-tag"><Icon name="refresh" size="sm" />Our old website</span></> : null}</small>
        </div>
        <StatusBadge order={o} />
      </div>
      <div className="oc-mid">
        <Photos photos={o.photos} more={o.more} />
        <div className="oc-sum"><span className="t">{orderTitle(o)}</span><span className="m">{pieces(o.pieces)}{o.methodText ? ` · ${o.methodText}` : ''}</span></div>
        <div className="oc-amt"><b>{rs(o.total)}</b><small>{amountLabel(o)}</small></div>
      </div>
      <p className="oc-next"><Icon name={icon} size="sm" /><span>{next}</span></p>
      <div className="oc-acts">
        {o.status === 'awaiting_payment' ? <Link className="btn btn-sm btn-primary" to={`/order/${o.number}`}><Icon name="lock" size="sm" />Pay now</Link> : null}
        <Link className={`btn btn-sm${o.status === 'awaiting_payment' ? '' : ' btn-primary'}`} to={`/order/${o.number}`} aria-label={`View order ${o.number}`}>View order</Link>
        {o.status === 'shipped' && o.shipping?.trackingNumber ? <Link className="btn btn-sm" to={`/order/${o.number}#tracking`} aria-label={`Track order ${o.number}`}><Icon name="truck" size="sm" />Track</Link> : null}
        {o.invoice?.ready && KEPT.has(o.status) ? <Button size="sm" icon="download" loading={busy === 'invoice'} onClick={invoice} aria-label={`Download the invoice of order ${o.number}`}>Invoice</Button> : null}
        {o.canBuyAgain ? <Button size="sm" icon="bag" loading={busy === 'buy'} onClick={buy} aria-label={`Buy order ${o.number} again`}>Buy again</Button> : null}
      </div>
    </article>
  );
}

// Paid → Packed → Shipped → Delivered.
export function Progress({ order }) {
  return (
    <section className="card" aria-label="Where your order is">
      <ol className="otrack">
        {steps(order).map((s) => (
          <li key={s.key} className={s.done ? 'done' : s.current ? 'now' : ''} aria-current={s.current ? 'step' : undefined}>
            <span><Icon name={s.done ? 'check' : s.icon} size="sm" /></span>
            <b>{s.title}</b>
            <small>{s.text}</small>
          </li>
        ))}
      </ol>
    </section>
  );
}

// 7.4 A: the courier, the number, Copy and DTDC's tracking page (it has no link per number).
export function Tracking({ order }) {
  const toast = useToast();
  const sh = order.shipping;
  if (!sh) return null;
  const when = order.status === 'delivered' && sh.deliveredAt ? `Delivered ${dayMonthYear(sh.deliveredAt)}` : `Shipped ${dayMonthYear(sh.shippedAt)}`;
  async function copy() {
    try {
      await navigator.clipboard.writeText(sh.trackingNumber);
      toast(`Tracking number ${sh.trackingNumber} copied`);
    } catch {
      toast('Couldn\'t copy. Select the number and copy it instead.', { tone: 'bad' });
    }
  }
  return (
    <section className="trk" id="tracking" aria-labelledby="trk-h" tabIndex={-1}>
      <div className="row1">
        <div>
          <h2 className="trk-h" id="trk-h">{when} · {sh.carrier} tracking number</h2>
          {sh.trackingNumber ? <div className="awb">{sh.trackingNumber}</div> : <p className="muted">The shop will add the tracking number.</p>}
        </div>
        {sh.trackingNumber ? (
          <div className="acts">
            <Button size="sm" icon="copy" onClick={copy}>Copy</Button>
            {sh.trackingUrl ? <a className="btn btn-sm btn-primary" href={sh.trackingUrl} target="_blank" rel="noopener noreferrer"><Icon name="external" size="sm" />Track on {sh.carrier}<span className="sr-only"> (opens a new tab)</span></a> : null}
          </div>
        ) : null}
      </div>
      {sh.trackingNumber ? (
        <small>{sh.trackingUrl ? `${sh.carrier}'s page opens: paste the number there.` : `Track it on ${sh.carrier}'s website with this number.`}{order.status === 'shipped' ? ' Delivery is usually 3 to 7 days after shipping.' : ''}</small>
      ) : null}
    </section>
  );
}
