// The side panel (5.2 A): slides in after "Add to bag" and from the header's bag. The sarees,
// the total, "Checkout" (W6, when payments are on), "View bag", "Keep shopping" and WhatsApp. Escape or the backdrop
// closes it; focus stays inside while it is open.
import { useEffect, useRef } from 'react';
import { Link, useLocation } from 'react-router-dom';
import Icon from './Icon.jsx';
import BagLine from '../pages/bag/BagLine.jsx';
import { useBag, bagLines, bagTotals } from '../bag/useBag.js';
import { useBagActions } from '../bag/useBagActions.js';
import { closePanel, isFresh, openWhatsApp, refresh } from '../bag/store.js';
import { useDialog } from '../utils/useDialog.js';
import { useOnline } from '../utils/useOnline.js';
import { usePaymentsOn } from '../payments/usePaymentsOn.js';
import { pieces, rs } from '../utils/money.js';
import TestPayNote from '../payments/TestPayNote.jsx';

function Panel({ added }) {
  const bag = useBag();
  const ref = useRef(null);
  const online = useOnline();
  const actions = useBagActions();
  const paymentsOn = usePaymentsOn();
  useDialog(ref, closePanel);
  useEffect(() => { if (!isFresh()) refresh(); }, []);
  const lines = bagLines(bag);
  const totals = bagTotals(lines);
  // The saree just added comes first.
  const shown = added ? [...lines].sort((a, b) => (b.slug === added) - (a.slug === added)) : lines;
  return (
    <>
      <div className="scrim" onClick={closePanel} aria-hidden="true" />
      <div className="drawer right" role="dialog" aria-modal="true" aria-labelledby="bag-panel-title" ref={ref} tabIndex={-1}>
        <div className="drawer-head">
          {added ? <span className="added" id="bag-panel-title"><Icon name="check" />Added to your bag</span> : <h2 id="bag-panel-title">Your bag</h2>}
          <button type="button" className="btn btn-icon" onClick={closePanel} aria-label="Close" data-autofocus><Icon name="x" /></button>
        </div>
        <div className="drawer-body">
          {lines.length ? (
            <div className="blines">
              {shown.map((l) => <BagLine key={l.slug} line={l} compact added={l.slug === added} onQuantity={actions.quantity} onRemove={actions.remove} busy={actions.busy} />)}
            </div>
          ) : (
            <div className="empty">
              <div className="ico-wrap"><Icon name="bag" /></div>
              <h3>Your bag is empty</h3>
              <Link className="btn btn-primary" to="/shop?sort=new" onClick={closePanel}>New in</Link>
            </div>
          )}
        </div>
        {lines.length ? (
          <div className="drawer-foot">
            <div className="sumrow total"><span>Total · {pieces(totals.pieces)}</span><span className="v">{rs(totals.amount)}</span></div>
            <p className="muted small" style={{ marginTop: '-.4rem' }}>Free delivery across India · includes all taxes{bag.status === 'checking' ? ' · checking…' : ''}</p>
            {paymentsOn && totals.pieces > 0 ? <Link className="btn btn-primary btn-lg btn-block" to="/checkout" onClick={closePanel}><Icon name="lock" size="sm" />Checkout</Link> : null}
            {paymentsOn ? <TestPayNote short /> : null}
            <div className="two">
              <Link className="btn btn-block" to="/bag" onClick={closePanel}>View bag</Link>
              <button type="button" className="btn btn-block" onClick={closePanel}>Keep shopping</button>
            </div>
            {paymentsOn ? (
              <button type="button" className="wa-link" onClick={openWhatsApp} disabled={!online || !totals.pieces}><Icon name="whatsapp" size="sm" />Order on WhatsApp instead</button>
            ) : (
              <button type="button" className="btn btn-wa btn-lg btn-block" onClick={openWhatsApp} disabled={!online || !totals.pieces}>
                <Icon name="whatsapp" size="sm" />Send bag on WhatsApp
              </button>
            )}
          </div>
        ) : null}
      </div>
    </>
  );
}

export default function BagPanel() {
  const bag = useBag();
  const { pathname } = useLocation();
  const first = useRef(pathname);
  // Moving to another page closes the panel.
  useEffect(() => {
    if (pathname !== first.current) { first.current = pathname; closePanel(); }
  }, [pathname]);
  return bag.panel ? <Panel added={bag.panel.added} /> : null;
}
