// One saree in the bag: photo, name, code, single piece or set, pieces, price, and a note when
// something changed since it was added (5.7 A: on the line; the page adds one summary note).
import { useState } from 'react';
import { Link } from 'react-router-dom';
import Icon from '../../components/Icon.jsx';
import QtyStepper from '../../components/QtyStepper.jsx';
import { useConfig } from '../../config/useConfig.js';
import { similarMessage, whatsAppLink } from '../../bag/message.js';
import { pieces, rs } from '../../utils/money.js';

export default function BagLine({ line, compact = false, added = false, onQuantity, onRemove, busy = false }) {
  const { config } = useConfig();
  const [broken, setBroken] = useState(false);
  const out = !line.buyable;
  const to = `/product/${line.slug}`;
  const isSet = line.available != null ? line.available > 1 : line.quantity > 1;
  const kind = line.state === 'unknown' ? null : line.available > 1 ? `Set · ${line.available} in stock` : line.available === 1 ? 'Single piece' : null;
  const ask = whatsAppLink(config.store.whatsapp, similarMessage(line));
  const label = `${line.name}${line.sku ? ` (${line.sku})` : ''}`;
  return (
    <article className={`bline is-enter${out ? ' is-out' : ''}${added ? ' is-new' : ''}`} data-slug={line.slug}>
      <Link className="ph" to={to} tabIndex={-1} aria-hidden="true">
        {line.photo?.url && !broken ? <img src={line.photo.url} alt="" loading="lazy" decoding="async" onError={() => setBroken(true)} /> : <span className="ph-missing"><Icon name="thread" /></span>}
      </Link>
      <div className="main">
        {line.craftName ? <span className="col">{line.craftName}</span> : null}
        <Link className="name" to={to}>{line.name}</Link>
        <span className="code">
          {line.sku ? <span>Code <b>{line.sku}</b></span> : null}
          {kind ? <span className="kind">{kind}</span> : null}
        </span>
        {line.state === 'sold_out' ? (
          <div className="lnote bad"><Icon name="alertc" /><span>Sold out: it sold since you added it. <a href={ask} target="_blank" rel="noopener noreferrer">Ask for a similar saree</a></span></div>
        ) : null}
        {line.state === 'unavailable' ? (
          <div className="lnote bad"><Icon name="alertc" /><span>No longer on the website. <a href={ask} target="_blank" rel="noopener noreferrer">Ask us on WhatsApp</a></span></div>
        ) : null}
        {line.fewerFrom ? <div className="lnote"><Icon name="alert" /><span>Only {line.available} left now. We changed it from {line.fewerFrom} to {line.quantity}.</span></div> : null}
        {line.priceWas != null ? (
          <div className="lnote info"><Icon name="info" /><span>Price {line.price > line.priceWas ? 'went up' : 'came down'} from {rs(line.priceWas)} to {rs(line.price)} since you added it.</span></div>
        ) : null}
        <div className="acts">
          {out ? null : isSet && !compact && line.available > 1 ? (
            <QtyStepper small value={line.quantity} max={line.available} onChange={(q) => onQuantity(line.slug, q)} disabled={busy} label={`Pieces of ${label}`} />
          ) : (
            <span className="qty-fixed">{pieces(line.quantity)}</span>
          )}
          <button type="button" className="rm" onClick={(e) => onRemove(line, e.currentTarget)} disabled={busy} aria-label={`Remove ${label}`}>
            <Icon name="trash" size="sm" />Remove
          </button>
        </div>
      </div>
      <div className="lt">
        {out ? (
          <><span className="price">{line.price != null && line.state === 'sold_out' ? rs(line.price) : '—'}</span><span className="each">Not counted</span></>
        ) : (
          <>
            <span className="price">{rs(line.lineTotal)}</span>
            {line.quantity > 1 ? <span className="each">{line.quantity} × {rs(line.price)}</span> : null}
            {line.priceWas != null ? <s>{rs(line.priceWas * line.quantity)}</s> : null}
          </>
        )}
      </div>
    </article>
  );
}
