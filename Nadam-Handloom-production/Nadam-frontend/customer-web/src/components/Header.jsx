import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import Icon from './Icon.jsx';
import { Avatar } from './bits.jsx';
import BagButton from './BagButton.jsx';
import SearchBox from './SearchBox.jsx';
import SideMenu from './SideMenu.jsx';
import CategoryPhoto from './CategoryPhoto.jsx';
import { useAuth } from '../auth/useAuth.js';
import { useCatalog } from '../data/shop.js';
import { peek } from '../data/resource.js';
import { allCategories, collectionsOf, roundPhoto, shortName, SOON } from '../data/categories.js';
import { useConfig } from '../config/useConfig.js';
import { CRAFT_NAMES } from '../data/crafts.js';
import { firstName, whatsappText } from '../utils/format.js';
import { num } from '../utils/money.js';

// Which menu item is the current page: all, new, sets or a category's slug.
function activeKey(pathname, search) {
  const sp = new URLSearchParams(search);
  if (pathname === '/') return 'all';
  if (pathname === '/shop') {
    if (sp.get('sets') === '1') return 'sets';
    if (sp.get('sort') === 'new' && !sp.get('q')) return 'new';
    if (sp.get('category')) return sp.get('category');
    return sp.get('q') ? '' : 'all';
  }
  const cat = pathname.match(/^\/category\/([^/]+)/);
  if (cat) return cat[1];
  const saree = pathname.match(/^\/product\/([^/]+)/);
  if (saree) return peek(`saree:${saree[1]}`)?.product?.category?.slug || '';
  return '';
}

// A category's menu on computers: its biggest collections, its crafts and a photo.
function Mega({ c, catalog }) {
  const name = shortName(c);
  if (c.soon) {
    return (
      <div className="mega" role="region" aria-label={name}>
        <div><h4>{SOON}</h4><ul>{c.upcoming.length ? c.upcoming.slice(0, 8).map((x) => <li key={x}><span className="muted">{x}</span></li>) : <li className="muted small">New pieces on the way</li>}</ul></div>
        <div />
        <Link className="promo" to={`/category/${c.slug}`}><CategoryPhoto photo={roundPhoto(c)} sizes="300px" /><b>{name}</b><span>{SOON}</span></Link>
      </div>
    );
  }
  const cols = collectionsOf(catalog, c.slug);
  const crafts = [...new Set(cols.map((x) => x.craft).filter(Boolean))].slice(0, 8);
  return (
    <div className="mega" role="region" aria-label={name}>
      <div>
        <h4>Collections</h4>
        <ul>
          {cols.slice(0, 8).map((x) => <li key={x.id}><Link to={`/category/${c.slug}/${x.id}`}>{x.name} <small>{num(x.count)}</small></Link></li>)}
          {cols.length > 8 ? <li><Link className="all" to={`/category/${c.slug}`}>All {cols.length} collections</Link></li> : null}
        </ul>
      </div>
      <div>
        <h4>Crafts</h4>
        <ul>{crafts.length > 1 ? crafts.map((k) => <li key={k}><Link to={`/shop?category=${c.slug}&craft=${k}`}>{CRAFT_NAMES[k]}</Link></li>) : <li className="muted small">{cols.length === 1 ? 'One collection' : 'One craft'}</li>}</ul>
      </div>
      <Link className="promo" to={`/category/${c.slug}`}><CategoryPhoto photo={roundPhoto(c)} sizes="300px" /><b>{name}</b><span>Shop all {num(c.count)} <Icon name="arrow" size="sm" /></span></Link>
    </div>
  );
}

// The client's design: a strip with the promises, the logo, a search bar, account and bag, and
// the category menu under it (with a menu for each category on computers). Phones get the
// side menu and the search bar on its own row.
export default function Header() {
  const [menu, setMenu] = useState(false);
  const { status, customer } = useAuth();
  const { config } = useConfig();
  const { data: catalog } = useCatalog();
  const { pathname, search } = useLocation();
  const active = activeKey(pathname, search);
  const cats = allCategories(catalog);
  const item = (to, label, key, extra = null) => (
    <li key={key}>
      <Link to={to} aria-current={active === key ? 'page' : undefined}>{label}</Link>
      {extra}
    </li>
  );

  return (
    <>
      <div className="top-strip" role="region" aria-label="Our promise">
        <div className="wrap">
          <span><Icon name="truck" />Free delivery across India</span>
          <span className="hide-sm"><Icon name="thread" />Handwoven in Old Mangalagiri</span>
          <span className="hide-sm"><Icon name="whatsapp" />Order on WhatsApp: <a href={`https://wa.me/${config.store.whatsapp}`} target="_blank" rel="noopener noreferrer">+91 {whatsappText(config)}</a></span>
        </div>
      </div>
      <header className="hdr">
        <div className="wrap hdr-row">
          <div className="brand">
            <button type="button" className="btn btn-icon menu-btn" onClick={() => setMenu(true)} aria-haspopup="dialog" aria-expanded={menu} aria-label="Menu"><Icon name="menu" /></button>
            <Link to="/" className="logo" aria-label="Nandam Handlooms, home">
              <img src="/img/logo-96.png" alt="" width="42" height="42" />
              <span className="wm"><b>Nandam</b><small>Handlooms · Mangalagiri</small></span>
            </Link>
          </div>
          <SearchBox />
          <div className="tools">
            {status === 'signedIn' && customer ? (
              <Link to="/account" className="tool acct-link" aria-label={`My account (${customer.fullName})`}>
                <Avatar name={customer.fullName} url={customer.avatarUrl} size={24} />
                <span className="lbl">{firstName(customer.fullName)}</span>
              </Link>
            ) : (
              <Link to="/sign-in" className="tool acct-link" aria-label="Sign in">
                <Icon name="user" />
                <span className="lbl">Sign in</span>
              </Link>
            )}
            <BagButton />
          </div>
        </div>
        <nav className="nav" aria-label="Shop">
          <div className="wrap">
            <ul>
              {item('/shop', 'All sarees', 'all')}
              {cats.map((c) => item(`/category/${c.slug}`, shortName(c), c.slug, <Mega c={c} catalog={catalog} />))}
              {item('/shop?sort=new', 'New in', 'new')}
              {item('/shop?sets=1', 'Sets', 'sets')}
            </ul>
          </div>
        </nav>
      </header>
      {menu ? <SideMenu onClose={() => setMenu(false)} /> : null}
    </>
  );
}
