import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import Icon from '../../components/Icon.jsx';
import { Avatar } from '../../components/bits.jsx';
import { useAuth } from '../../auth/useAuth.js';
import { shopApi } from '../../api/shop.js';
import { useMyOrders } from '../../orders/useMyOrders.js';
import { nextLine } from '../../orders/status.js';
import { Photos, StatusBadge } from '../../orders/parts.jsx';
import { formatMobile, firstName, longDate, plural } from '../../utils/format.js';
import { permission } from '../../push/push.js';
import '../../theme/checkout.css';
import '../../theme/orders.css';

// W7: the newest order (being paid for, packed, shipped …) on the overview.
function LatestOrder() {
  const { status, orders, nextOffset } = useMyOrders({ fresh: true });
  const o = orders[0];
  if (status === 'loading' && !o) return null;
  if (!o) return null;
  const count = nextOffset == null ? plural(orders.length, 'order') : `${orders.length}+ orders`;
  return (
    <section className="card stack-sm" aria-labelledby="latest-h">
      <div className="row-between">
        <h2 className="h-sm" id="latest-h">Your latest order</h2>
        <Link className="link" to="/account/orders">All my orders ({count})</Link>
      </div>
      <div className="latest">
        <Photos photos={o.photos} max={1} />
        <div className="oc-sum">
          <span><b>Order <span className="tnum">{o.number}</span></b> <StatusBadge order={o} /></span>
          <span className="m">{nextLine(o)[1]}</span>
        </div>
        <Link className={`btn${o.status === 'awaiting_payment' ? ' btn-primary' : ''}`} to={`/order/${o.number}`}>{o.status === 'awaiting_payment' ? 'Pay now' : 'View order'}</Link>
      </div>
    </section>
  );
}

const PARTS = ['fullName', 'email', 'mobile', 'pincode', 'city', 'state', 'avatarUrl', 'dateOfBirth', 'anniversary', 'language'];

export default function OverviewPage() {
  const { customer: c } = useAuth();
  const [addresses, setAddresses] = useState(null);
  useEffect(() => {
    let live = true;
    shopApi.addresses().then((r) => { if (live) setAddresses(r.addresses.length); }).catch(() => {});
    return () => { live = false; };
  }, []);
  if (!c) return null;
  const done = PARTS.filter((k) => c[k]).length;
  const pct = Math.round((done / PARTS.length) * 100);
  const missing = [!c.avatarUrl && 'a profile picture', !c.dateOfBirth && 'your birthday', !c.anniversary && 'your anniversary', !c.language && 'your language'].filter(Boolean);
  const notif = 'Notification' in window && permission() === 'granted' ? 'On for this browser' : 'Off on this browser';
  return (
    <div className="stack-lg">
      <div className="card-flat hello">
        <Avatar name={c.fullName} url={c.avatarUrl} size={72} />
        <div>
          <span className="eyebrow">Welcome back</span>
          <h2>Namaste, {firstName(c.fullName)}</h2>
          <p className="muted">+91 {formatMobile(c.mobile)} · {c.email}{c.city ? ` · ${c.city}, ${c.state}` : ''}</p>
          {c.memberSince ? <p className="muted small">With us since {longDate(c.memberSince)}</p> : null}
        </div>
      </div>
      {pct < 100 ? (
        <div className="card stack-sm">
          <div className="row-between">
            <b>Your profile is {pct}% complete</b>
            <Link className="link" to="/account/profile">Complete it</Link>
          </div>
          <div className="progress" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label="Profile complete"><i style={{ width: `${pct}%` }} /></div>
          <span className="muted small">Add {missing.join(', ').replace(/, ([^,]*)$/, ' and $1')} for festive surprises and a more personal shop.</span>
        </div>
      ) : null}
      <LatestOrder />
      <div className="grid-3">
        <Link className="card tile-link" to="/account/orders">
          <Icon name="box" />
          <b>My orders</b>
          <span className="muted">Track them, invoices, buy again</span>
        </Link>
        <Link className="card tile-link" to="/account/addresses">
          <Icon name="pin" />
          <b>{addresses == null ? 'Addresses' : plural(addresses, 'saved address', 'saved addresses')}</b>
          <span className="muted">Add, edit, choose the default</span>
        </Link>
        <Link className="card tile-link" to="/account/notifications">
          <Icon name="spark" />
          <b>Notifications</b>
          <span className="muted">{notif}</span>
        </Link>
      </div>
    </div>
  );
}
