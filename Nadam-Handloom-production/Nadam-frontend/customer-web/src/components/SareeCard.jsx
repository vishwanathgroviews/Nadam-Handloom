import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Icon from './Icon.jsx';
import { useToast } from './Toasts.jsx';
import { useBag } from '../bag/useBag.js';
import { add, openPanel } from '../bag/store.js';
import { rs } from '../utils/money.js';
import { cardLabel } from '../data/crafts.js';

// Saree card (the client's design, 26 Oct 2026): the photo, the label, name, price and code,
// and "Add to bag" (one piece; a set's pieces are chosen on the saree page).
export default function SareeCard({ card, index = 0, label = 'collection', eager = false }) {
  const [broken, setBroken] = useState(false);
  const [adding, setAdding] = useState(false);
  const toast = useToast();
  const navigate = useNavigate();
  const inBag = useBag().items.some((it) => it.slug === card.slug);
  const to = `/product/${card.slug}`;
  const sold = card.available < 1;
  const set = card.available > 1;

  async function addToBag() {
    if (inBag) { openPanel(null); return; }
    if (adding) return;
    setAdding(true);
    try {
      await add({ slug: card.slug, sku: card.sku, name: card.name, price: card.price, available: card.available, photo: card.photo }, 1);
    } catch (err) {
      toast(err.message, { tone: 'bad', ...(err.code === 'BAG_FULL' ? { action: { label: 'View bag', onClick: () => navigate('/bag') } } : {}) });
    } finally {
      setAdding(false);
    }
  }

  return (
    <article className={`pcard reveal${sold ? ' soldout' : ''}${inBag ? ' added' : ''}`} style={{ '--i': index % 8 }}>
      <Link className="ph" to={to} aria-label={`${card.name}, ${rs(card.price)}${set ? `, set of ${card.available}` : ''}`}>
        {card.photo && !broken ? (
          <img src={card.photo.url} alt={card.photo.alt} loading={eager ? 'eager' : 'lazy'} decoding="async" width="600" height="800" onError={() => setBroken(true)} />
        ) : (
          <span className="ph-missing"><Icon name="thread" /></span>
        )}
        <span className="tags">
          {card.isNew && !sold ? <span className="badge new">New</span> : null}
          {set ? <span className="badge set">Set of {card.available}</span> : null}
          {sold ? <span className="badge out">Sold out</span> : null}
        </span>
      </Link>
      <div className="info">
        <span className="col">{cardLabel(card, label)}</span>
        <Link className="name" to={to}>{card.name}</Link>
        <div className="row">
          <span className="price">{rs(card.price)}</span>
          <span className="sku">{card.sku}</span>
        </div>
      </div>
      <div className="acts">
        {sold ? (
          <Link className="btn btn-sm" to={to}>See details</Link>
        ) : (
          <button type="button" className={`btn btn-sm${inBag ? ' btn-inbag' : ' btn-primary'}${adding ? ' is-loading' : ''}`} onClick={addToBag} aria-label={`${inBag ? 'In your bag' : 'Add to bag'}: ${card.name}`}>
            <Icon name={inBag ? 'check' : 'bag'} size="sm" />{inBag ? 'In your bag' : 'Add to bag'}
          </button>
        )}
      </div>
    </article>
  );
}

export function CardSkeletons({ n = 8 }) {
  return Array.from({ length: n }, (_, i) => (
    <div key={i} className="pcard skel-card" aria-hidden="true">
      <div className="ph"><div className="skel" /></div>
      <div className="info"><div className="skel" style={{ height: 10, width: '50%' }} /><div className="skel" style={{ height: 16, width: '80%' }} /><div className="skel" style={{ height: 12, width: '30%' }} /></div>
    </div>
  ));
}
