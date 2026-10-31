import { Link } from 'react-router-dom';
import Icon from './Icon.jsx';
import ThemeSwitch from './ThemeSwitch.jsx';
import { useConfig } from '../config/useConfig.js';
import { useAuth } from '../auth/useAuth.js';
import { useCatalog } from '../data/shop.js';
import { allCategories, shortName } from '../data/categories.js';
import { formatMobile, whatsappText } from '../utils/format.js';

// The help pages: in the footer on the home page, and in one line on every other page.
const HELP = [['/shipping', 'Shipping'], ['/refunds', 'Cancellation and refunds'], ['/contact', 'Contact us'], ['/privacy', 'Privacy'], ['/terms', 'Terms']];

// The home page's footer: the promises, the shop's details, the store and the theme.
export default function Footer() {
  const { config } = useConfig();
  const { status } = useAuth();
  const { data: catalog } = useCatalog();
  const st = config.store;
  return (
    <>
      <section className="trust" aria-label="Why shop with us">
        <div className="wrap">
          <div><Icon name="truck" /><span><b>Free delivery</b>Anywhere in India</span></div>
          <div><Icon name="thread" /><span><b>Handwoven in Mangalagiri</b>From our store in Old Mangalagiri</span></div>
          <div><Icon name="shield" /><span><b>Secure payment</b>UPI, cards and net banking</span></div>
          <div><Icon name="whatsapp" /><span><b>Help on WhatsApp</b>+91 {whatsappText(config)}</span></div>
        </div>
      </section>
      <footer className="ftr">
        <div className="wrap">
          <div className="cols">
            <div className="brand">
              <Link to="/" className="logo"><img src="/img/logo-96.png" alt="" width="42" height="42" loading="lazy" /><span className="wm"><b>Nandam</b><small>Handlooms · Mangalagiri</small></span></Link>
              <p>Mangalagiri handloom pattu sarees, dress materials and lehanga sets, from our store in Old Mangalagiri to your door.</p>
              <ul>
                {status === 'signedIn'
                  ? <><li><Link to="/account">My account</Link></li><li><Link to="/account/orders">My orders</Link></li></>
                  : <li><Link to="/sign-in">Sign in or create an account</Link></li>}
              </ul>
            </div>
            <div>
              <h4>Shop</h4>
              <ul>
                <li><Link to="/shop">All sarees</Link></li>
                {allCategories(catalog).map((c) => <li key={c.slug}><Link to={`/category/${c.slug}`}>{shortName(c)}</Link></li>)}
                <li><Link to="/collections">All collections</Link></li>
                <li><Link to="/shop?sort=new">New in</Link></li>
                <li><Link to="/shop?sets=1">Sets for the family</Link></li>
              </ul>
            </div>
            <div>
              <h4>Help</h4>
              <ul>
                <li><a href={`https://wa.me/${st.whatsapp}`} target="_blank" rel="noopener noreferrer">WhatsApp us</a></li>
                <li><a href={`tel:+91${config.shop.mobile}`}>Call +91 {formatMobile(config.shop.mobile)}</a></li>
                {HELP.map(([to, label]) => <li key={to}><Link to={to}>{label}</Link></li>)}
              </ul>
            </div>
            <div id="store">
              <h4>Visit the store</h4>
              <ul>
                <li>{st.addressLines.map((l) => <span key={l} style={{ display: 'block' }}>{l}</span>)}</li>
                <li>{st.hours}</li>
                <li><a href={st.mapUrl} target="_blank" rel="noopener noreferrer">Directions on Google Maps <Icon name="external" size="sm" /></a></li>
              </ul>
            </div>
          </div>
          <div className="bottom">
            <span>© {new Date().getFullYear()} Nandam Handlooms, Mangalagiri. All prices include taxes. GSTIN {config.shop.gstin}</span>
            <span className="ftr-theme"><span>Theme</span><ThemeSwitch /></span>
          </div>
        </div>
      </footer>
    </>
  );
}

// Every other page: the help pages in one line.
export function FooterLine() {
  return (
    <footer className="ftr-line">
      <div className="wrap">
        <span>© {new Date().getFullYear()} Nandam Handlooms, Mangalagiri</span>
        <nav aria-label="Help">{HELP.map(([to, label]) => <Link key={to} to={to}>{label}</Link>)}</nav>
      </div>
    </footer>
  );
}
