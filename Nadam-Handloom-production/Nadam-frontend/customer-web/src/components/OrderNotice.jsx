// "Your order NH… is confirmed" across the website, for a payment whose page didn't get to
// say so (on a phone, paying in GPay or PhonePe can close our page; the server still completes
// the order). Shown once per order and state; not on the checkout or the order page itself.
// The customer's orders come through the reply cache, shared with My orders (asked again after a
// minute, and when the customer comes back to the tab).
import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import Icon from './Icon.jsx';
import { useAuth } from '../auth/useAuth.js';
import { ensure, useResource } from '../data/resource.js';
import { markSeen, newsOf } from '../orders/seen.js';
import { firstPage as loader, myOrdersKey } from '../orders/useMyOrders.js';
import { rs } from '../utils/money.js';

export default function OrderNotice() {
  const { status, customer } = useAuth();
  const { pathname } = useLocation();
  const [, setClosed] = useState(0); // re-draws after "seen"
  const key = myOrdersKey(status, customer);
  const { data } = useResource(key, loader);
  useEffect(() => {
    if (!key) return undefined;
    const onShow = () => { if (document.visibilityState === 'visible') ensure(key, loader); };
    document.addEventListener('visibilitychange', onShow);
    return () => document.removeEventListener('visibilitychange', onShow);
  }, [key]);

  const order = key ? newsOf(data?.orders) : null;
  if (!order || pathname === '/checkout' || pathname.startsWith('/order/')) return null;
  const done = () => { markSeen(order.number, order.status); setClosed((n) => n + 1); };
  const text = order.status === 'paid'
    ? <>Your order <b className="tnum">{order.number}</b> is confirmed and paid: {rs(order.total)}.</>
    : order.status === 'confirming'
      ? <>Your payment for order <b className="tnum">{order.number}</b> is being confirmed with your bank.</>
      : <>Order <b className="tnum">{order.number}</b> couldn&apos;t be kept: your {rs(order.refund?.amount ?? order.total)} is being refunded.</>;
  return (
    <div className={`order-notice ${order.status}`} role="status">
      <div className="wrap">
        <Icon name={order.status === 'refunded' ? 'refresh' : order.status === 'paid' ? 'check' : 'clock'} size="sm" />
        <span className="t">{text}</span>
        {/* The payment's own ending (Thank you, confirming, refunded): its page never said it. */}
        <Link className="btn btn-sm" to={`/order/${order.number}`} state={{ paid: true }} onClick={done}>See the order</Link>
        <button type="button" className="btn btn-icon btn-sm" onClick={done} aria-label="Close this message"><Icon name="x" size="sm" /></button>
      </div>
    </div>
  );
}
