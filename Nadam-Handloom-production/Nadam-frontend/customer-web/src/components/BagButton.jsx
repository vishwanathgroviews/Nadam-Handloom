import { useLocation } from 'react-router-dom';
import Icon from './Icon.jsx';
import { useBag, bagLines, bagTotals } from '../bag/useBag.js';
import { openPanel } from '../bag/store.js';
import { pieces } from '../utils/money.js';

// The bag in the header (5.5 A): an icon with the number of pieces. It opens the side panel
// (on the bag page itself it goes back to the top).
export default function BagButton() {
  const bag = useBag();
  const { pathname } = useLocation();
  const n = bagTotals(bagLines(bag)).pieces;
  const onClick = () => {
    if (pathname === '/bag') window.scrollTo({ top: 0, behavior: 'smooth' });
    else openPanel(null);
  };
  return (
    <button type="button" className="tool bag-link" onClick={onClick} aria-label={n ? `Bag, ${pieces(n)}` : 'Bag, empty'} aria-haspopup="dialog">
      <Icon name="bag" />
      <span className="lbl">Bag</span>
      {/* A new key after each "Add to bag" draws the number again, so it bounces once. */}
      {n ? <span key={bag.bumpAt} className={`bag-n${bag.bumpAt ? ' pop' : ''}`} aria-hidden="true">{n > 99 ? '99+' : n}</span> : null}
    </button>
  );
}
