// Pieces the checkout and the order page share: an address, the sarees, the hold, the GST note.
import { useState } from 'react';
import Icon from '../../components/Icon.jsx';
import Modal from '../../components/Modal.jsx';
import { formatMobile, labelName } from '../../utils/format.js';
import { pieces, rs } from '../../utils/money.js';
import { addressText, clock } from './format.js';

export function AddressBlock({ a, showLabel = true }) {
  return (
    <>
      <span className="ad-name">
        <b>{a.fullName}</b>
        {showLabel && a.label ? <span className="badge">{labelName(a.label)}</span> : null}
        {showLabel && a.isDefault ? <span className="badge badge-gold">Default</span> : null}
      </span>
      <span className="ad-lines">{addressText(a)}</span>
      <span className="ad-phone"><Icon name="phone" size="sm" />+91 {formatMobile(a.mobile)}</span>
    </>
  );
}

function Photo({ photo }) {
  const [broken, setBroken] = useState(false);
  const url = typeof photo === 'string' ? photo : photo?.url;
  if (!url || broken) return <span className="ph" aria-hidden="true" />;
  return <img src={url} alt="" loading="lazy" decoding="async" onError={() => setBroken(true)} />;
}

// lines: [{ slug, name, sku, photo, quantity, price, lineTotal, priceWas?, fewerFrom?, available? }]
export function SareeLines({ lines }) {
  return (
    <ul className="co-lines">
      {lines.map((l) => (
        <li key={l.slug || l.name}>
          <Photo photo={l.photo} />
          <span className="t">
            <b>{l.name}</b>
            <span className="muted small">
              {l.sku ? `Code ${l.sku} · ` : ''}{pieces(l.quantity)}
              {l.priceWas != null ? <> · <span className="chg">price changed from {rs(l.priceWas)}</span></> : null}
              {l.fewerFrom ? <> · <span className="chg">only {l.available} left: changed from {l.fewerFrom}</span></> : null}
            </span>
          </span>
          <span className="price">{rs(l.lineTotal ?? l.price * l.quantity)}</span>
        </li>
      ))}
    </ul>
  );
}

// 6.5 A: one quiet line.
export function HoldLine({ until }) {
  if (!until) return null;
  return <p className="hold-line" role="status"><Icon name="clock" size="sm" /><span>Your sarees are held for you until <b>{clock(until)}</b>.</span></p>;
}

// While our server checks a payment with Razorpay: focus moves in and stays (nothing behind it,
// like "Change my bag", can be pressed meanwhile), and it can't be closed.
export function ConfirmingPayment() {
  return (
    <Modal busy role="alertdialog" className="conf" labelledBy="cf-h" describedBy="cf-p">
      <span className="spin-ring" aria-hidden="true" />
      <h3 id="cf-h">Confirming your payment</h3>
      <p id="cf-p" className="muted">Checking with Razorpay that the money arrived. Please don&apos;t close this page.</p>
    </Modal>
  );
}
