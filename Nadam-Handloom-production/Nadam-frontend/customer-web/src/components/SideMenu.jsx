import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Link, useLocation } from 'react-router-dom';
import Icon from './Icon.jsx';
import { useAuth } from '../auth/useAuth.js';
import { useCatalog } from '../data/shop.js';
import { useConfig } from '../config/useConfig.js';
import { allCategories, shortName, SOON } from '../data/categories.js';
import { useDialog } from '../utils/useDialog.js';
import { whatsappText } from '../utils/format.js';
import { num } from '../utils/money.js';

// The menu on phones and tablets: every category, the crafts and the account, from the left.
export default function SideMenu({ onClose }) {
  const { status } = useAuth();
  const { config } = useConfig();
  const { data: catalog } = useCatalog();
  const { pathname, search } = useLocation();
  const ref = useRef(null);
  const first = useRef(pathname + search);
  useDialog(ref, onClose);
  // Choosing a page closes the menu.
  useEffect(() => { if (pathname + search !== first.current) onClose(); }, [pathname, search, onClose]);

  const link = (to, label, small) => <Link key={to} to={to}>{label}{small != null ? <small>{small}</small> : null}</Link>;
  return createPortal(
    <>
      <div className="scrim" onClick={onClose} aria-hidden="true" />
      <div className="drawer left" role="dialog" aria-modal="true" aria-label="Menu" ref={ref}>
        <div className="drawer-head">
          <Link to="/" className="logo"><img src="/img/logo-96.png" alt="" width="36" height="36" /><span className="wm"><b>Nandam</b></span></Link>
          <button type="button" className="btn btn-icon" onClick={onClose} aria-label="Close the menu"><Icon name="x" /></button>
        </div>
        <nav className="drawer-body side-nav" aria-label="Shop and account">
          <h4>Shop</h4>
          {link('/shop', 'All sarees', catalog ? num(catalog.totals.sarees) : null)}
          {allCategories(catalog).map((c) => link(`/category/${c.slug}`, shortName(c), c.soon ? SOON : num(c.count)))}
          {link('/collections', 'All collections', catalog ? num(catalog.totals.collections) : null)}
          {link('/shop?sort=new', 'New in')}
          {link('/shop?sets=1', 'Sets for the family')}
          {catalog?.crafts.length ? <h4>Crafts</h4> : null}
          {(catalog?.crafts || []).map((k) => link(`/shop?craft=${k.key}`, k.name, num(k.count)))}
          <h4>You</h4>
          {status === 'signedIn' ? [link('/account/orders', 'My orders'), link('/account', 'My account')] : link('/sign-in', 'Sign in')}
          {link('/bag', 'Bag')}
          <a href={`https://wa.me/${config.store.whatsapp}`} target="_blank" rel="noopener noreferrer">WhatsApp us<small>+91 {whatsappText(config)}</small></a>
          {link('/#store', 'Visit the store')}
        </nav>
      </div>
    </>,
    document.body,
  );
}
