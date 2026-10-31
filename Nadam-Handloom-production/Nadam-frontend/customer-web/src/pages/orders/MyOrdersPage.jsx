// My orders (W7, /account/orders, a tab of My account, 7.1 A): every website order of the
// customer, newest first, 20 at a time (rule 2). Only orders paid for show (and one being paid
// for while its sarees are held); a checkout that wasn't finished isn't an order.
import { Link } from 'react-router-dom';
import Alert from '../../components/Alert.jsx';
import Button from '../../components/Button.jsx';
import { EmptyState, Skeleton } from '../../components/bits.jsx';
import { useToast } from '../../components/Toasts.jsx';
import { useMyOrders } from '../../orders/useMyOrders.js';
import { OrderCard } from '../../orders/parts.jsx';
import { plural } from '../../utils/format.js';
import '../../theme/checkout.css';
import '../../theme/orders.css';

export default function MyOrdersPage() {
  const toast = useToast();
  const { status, error, orders, nextOffset, loadingMore, loadMore, reload } = useMyOrders({ fresh: true });

  if (status === 'loading' && !orders.length) {
    return <div className="olist-skel" aria-busy="true" aria-label="Loading your orders"><Skeleton h={210} /><Skeleton h={210} /><Skeleton h={210} /></div>;
  }
  // Never "No orders yet" when the list didn't load (an old website problem).
  if (status === 'error' && !orders.length) {
    return (
      <Alert tone="bad" icon="wifioff" title="Your orders didn't load" actions={<Button size="sm" icon="refresh" onClick={reload}>Try again</Button>}>
        {error?.message || 'Check your connection and try again.'} Your orders are safe.
      </Alert>
    );
  }
  if (!orders.length) {
    return (
      <EmptyState icon="box" title="No orders yet" text="When you buy a saree on the website, it shows here: track it, download its invoice, buy it again.">
        <div className="row-wrap" style={{ justifyContent: 'center' }}>
          <Link className="btn btn-primary" to="/shop?sort=new">New in</Link>
          <Link className="btn" to="/collections">All collections</Link>
        </div>
      </EmptyState>
    );
  }

  async function more() {
    const before = orders.length;
    try {
      await loadMore();
      // The first newly shown order takes the focus, so a keyboard or screen reader carries on there.
      requestAnimationFrame(() => document.querySelectorAll('.ocard')[before]?.querySelector('a, button')?.focus());
    } catch (err) {
      toast(err.message, { tone: 'bad' });
    }
  }

  return (
    <div>
      <div className="olist-head"><p className="muted">{nextOffset == null ? plural(orders.length, 'order') : `${orders.length} most recent orders`} · newest first</p></div>
      <div className="olist">
        {orders.map((o, i) => <OrderCard key={o.number} order={o} index={i} />)}
      </div>
      {nextOffset != null
        ? <Button block className="olist-end" loading={loadingMore} onClick={more}>Show more</Button>
        : <p className="muted small olist-end">{orders.length > 1 ? `That's all ${orders.length} orders.` : 'That\'s your only order so far.'}</p>}
      <p className="muted small olist-note">Only orders you paid for show here (and one you&apos;re paying for now). A checkout you didn&apos;t finish isn&apos;t an order.</p>
    </div>
  );
}
