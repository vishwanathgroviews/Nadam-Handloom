import { Link } from 'react-router-dom';
import { rs, num } from '../utils/money.js';

// A collection as a photo tile (client's design A, 26 Oct 2026): the name, pieces and price on
// the photo, and "New" when its newest saree came in the last few days.
export default function CollectionTile({ c, index = 0 }) {
  return (
    <Link className="ctile reveal" style={{ '--i': index % 8 }} to={`/category/${c.category}/${c.id}`}>
      <span className="ph">
        {c.image ? <img src={c.image} alt="" loading="lazy" decoding="async" /> : <span className="ph-missing" />}
        {c.hasNew ? <span className="tags"><span className="badge new">New</span></span> : null}
      </span>
      <span className="t"><b>{c.name}</b><span>{num(c.count)} {c.count === 1 ? 'piece' : 'pieces'} · {rs(c.price)}</span></span>
    </Link>
  );
}

export function TileSkeletons({ n = 8 }) {
  return Array.from({ length: n }, (_, i) => <div key={i} className="ctile sk" aria-hidden="true"><span className="skel" /></div>);
}
