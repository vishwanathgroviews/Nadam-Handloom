// My account (W1, web-01 section 4.3): the tabs (My orders since W7), and on every tab the
// "Keep my account" banner while a deletion is waiting.
import { useEffect, useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import Icon from '../../components/Icon.jsx';
import Button from '../../components/Button.jsx';
import Alert from '../../components/Alert.jsx';
import { Crumbs } from '../../components/bits.jsx';
import { useToast } from '../../components/Toasts.jsx';
import { useAuth } from '../../auth/useAuth.js';
import { signOut, updateCustomer } from '../../auth/session.js';
import { shopApi } from '../../api/shop.js';
import { longDate } from '../../utils/format.js';
import { useTitle } from '../../utils/useTitle.js';

const TABS = [
  ['/account', 'user', 'Overview'],
  ['/account/orders', 'box', 'My orders'],
  ['/account/profile', 'edit', 'Profile'],
  ['/account/addresses', 'pin', 'Addresses'],
  ['/account/notifications', 'spark', 'Notifications'],
  ['/account/devices', 'laptop', 'Signed-in devices'],
  ['/account/delete', 'trash', 'Delete account'],
];

function DeletionBanner({ deletion }) {
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  if (!deletion) return null;
  async function keep() {
    setBusy(true);
    try {
      await shopApi.cancelDeletion();
      const { customer } = await shopApi.me();
      updateCustomer(customer);
      toast('Your account is kept. Nothing was deleted.');
    } catch (ex) {
      toast(ex.message, { tone: 'bad' });
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="state-banner">
      <Alert tone="warn" title={deletion.overdue ? 'Your account is waiting to be deleted' : `Your account will be deleted on ${longDate(deletion.deletesOn)}`}
        actions={<Button size="sm" kind="primary" loading={busy} onClick={keep}>Keep my account</Button>}>
        {deletion.overdue
          ? 'It goes as soon as any order on its way to you is delivered. Orders and invoices stay with the shop for tax.'
          : 'Your profile and addresses go then; orders and invoices stay with the shop for tax.'}
      </Alert>
    </div>
  );
}

export default function AccountLayout() {
  const { customer } = useAuth();
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const toast = useToast();
  const [leaving, setLeaving] = useState(false);
  const tab = TABS.find(([to]) => to === pathname.replace(/\/$/, '')) || TABS[0];
  const title = tab[0] === '/account' ? 'My account' : tab[2];
  useTitle(title);

  // Fresh details on every tab and whenever the window comes back into view: they may have
  // changed on another device, or this device may have been signed out from another one.
  useEffect(() => {
    const fresh = () => shopApi.me().then((r) => updateCustomer(r.customer)).catch(() => {});
    fresh();
    const onShow = () => { if (document.visibilityState === 'visible') fresh(); };
    document.addEventListener('visibilitychange', onShow);
    return () => document.removeEventListener('visibilitychange', onShow);
  }, [pathname]);

  async function leave() {
    setLeaving(true);
    await signOut(() => navigate('/', { replace: true }));
    toast('Signed out');
  }

  return (
    <div className="wrap page-enter">
      <div className="page-head">
        <Crumbs items={tab[0] === '/account' ? [['Home', '/'], ['My account']] : [['Home', '/'], ['My account', '/account'], [tab[2]]]} />
        <h1>{title}</h1>
      </div>
      <DeletionBanner deletion={customer?.deletion} />
      <div className="acct">
        <nav aria-label="My account">
          {TABS.map(([to, icon, label]) => (
            <NavLink key={to} to={to} end aria-current={pathname.replace(/\/$/, '') === to ? 'page' : undefined}>
              <Icon name={icon} size="sm" />{label}
            </NavLink>
          ))}
          <button type="button" className="nav-btn" onClick={leave} disabled={leaving}><Icon name="logout" size="sm" />Sign out</button>
        </nav>
        <div className="acct-body"><Outlet /></div>
      </div>
      <div style={{ height: 'clamp(48px,6vw,90px)' }} />
    </div>
  );
}
