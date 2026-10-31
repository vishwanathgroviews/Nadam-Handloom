// Home, in the design the client picked ("products first", option A, 26 Oct 2026): every
// category as a card at the top (27 Oct, web-11 mock-up), the crafts, the latest collections,
// then every saree with filters and sort. The shop's details are in the footer, shown on this
// page only.
import { useRef } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import Icon from '../../components/Icon.jsx';
import CategoryPhoto from '../../components/CategoryPhoto.jsx';
import CollectionTile, { TileSkeletons } from '../../components/CollectionTile.jsx';
import { Rail, RailNav } from '../../components/Rail.jsx';
import { useRail } from '../../components/useRail.js';
import ShopList from '../shop/ShopList.jsx';
import Alerts from './Alerts.jsx';
import { useCatalog } from '../../data/shop.js';
import { allCategories, cardPhoto, shortName } from '../../data/categories.js';
import { useConfig } from '../../config/useConfig.js';
import { useReveal } from '../../utils/motion.js';
import { useTitle } from '../../utils/useTitle.js';
import { useMeta } from '../../utils/useMeta.js';
import { num } from '../../utils/money.js';

const LATEST = 10;

// The 6 categories as cards (client, 27 Oct 2026): 3 in a row (2 on phones), each only its
// photo, shaped like a saree card, and its name. A card opens the category's page (its
// subcategories); one without sarees yet opens its "coming soon" page.
function CategoryCards({ catalog }) {
  const cats = catalog ? allCategories(catalog) : null;
  return (
    <section className="cat-sec" aria-labelledby="h-cats">
      <div className="block-head">
        <div><h2 id="h-cats">Shop by category</h2><p className="muted small">{cats ? `All ${cats.length} categories` : 'Every category'} from our store in Old Mangalagiri</p></div>
        {catalog ? <Link className="more" to="/shop">All {num(catalog.totals.sarees)} sarees <Icon name="right" size="sm" /></Link> : null}
      </div>
      {cats ? (
        <ul className="ccards" aria-label="Categories">
          {cats.map((c) => (
            <li key={c.slug}>
              <Link className="ccard" to={`/category/${c.slug}`}>
                <span className="ph"><CategoryPhoto photo={cardPhoto(c)} sizes="(max-width: 640px) 50vw, 33vw" /></span>
                <span className="nm">{shortName(c)}</span>
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <div className="ccards" aria-hidden="true">{Array.from({ length: 6 }, (_, i) => <span key={i} className="ccard sk"><span className="ph"><span className="skel" style={{ position: 'absolute', inset: 0 }} /></span><span className="skel" style={{ height: 16, width: '55%' }} /></span>)}</div>
      )}
    </section>
  );
}

// The crafts as small round photos, under the cards.
function CraftStrip({ catalog, craft }) {
  const crafts = catalog?.crafts.filter((k) => k.image);
  if (!crafts?.length) return null;
  return (
    <nav className="cat-strip craft-strip" aria-label="Shop by craft">
      <span className="cs-h">By craft</span>
      {crafts.map((k) => (
        <Link key={k.key} className="cs" to={`/shop?craft=${k.key}`} aria-current={craft === k.key ? 'true' : undefined}>
          <span className="ph"><img src={k.image} alt="" loading="lazy" decoding="async" /></span>
          {k.name}<small>{num(k.count)}</small>
        </Link>
      ))}
    </nav>
  );
}

// The collections whose newest saree came in most recently.
function LatestCollections({ catalog }) {
  const rail = useRail();
  const cols = catalog ? [...catalog.collections].sort((a, b) => (b.newest || '').localeCompare(a.newest || '')).slice(0, LATEST) : null;
  const fresh = catalog?.totals.newSarees || 0;
  return (
    <section className="latest" aria-labelledby="h-latest">
      <div className="block-head">
        <div><h2 id="h-latest">Latest collections</h2><p className="muted small">The collections with the newest sarees from our store</p></div>
        <div className="side">
          <RailNav rail={rail} label="latest collections" />
          {fresh ? <Link className="more" to="/shop?sort=new">{num(fresh)} new {fresh === 1 ? 'saree' : 'sarees'} <Icon name="right" size="sm" /></Link> : null}
        </div>
      </div>
      <Rail rail={rail} label="Latest collections" className="tiles">
        {cols ? cols.map((c, i) => <CollectionTile key={c.id} c={c} index={i} />) : <TileSkeletons n={6} />}
      </Rail>
    </section>
  );
}

export default function HomePage() {
  useTitle('');
  useMeta('Handwoven Mangalagiri pattu sarees, dress materials and lehanga sets from Nandam Handlooms, Old Mangalagiri. Free delivery across India.');
  const { data: catalog, status, reload } = useCatalog();
  const { config } = useConfig();
  const [sp] = useSearchParams();
  const page = useRef(null);
  useReveal(page, [status]);
  const crafts = (sp.get('craft') || '').split(',').filter(Boolean);
  const store = { ...config.store, phone: config.shop.mobile };
  const ld = {
    '@context': 'https://schema.org',
    '@type': 'ClothingStore',
    name: 'Nandam Handlooms',
    url: window.location.origin,
    image: `${window.location.origin}/img/site/lamps-1200.jpg`,
    telephone: `+91${store.phone}`,
    address: { '@type': 'PostalAddress', streetAddress: store.addressLines.slice(0, 2).join(', '), addressLocality: 'Mangalagiri', addressRegion: 'Andhra Pradesh', postalCode: '522503', addressCountry: 'IN' },
    openingHours: store.openingHours || 'Mo-Su 09:30-20:30',
    hasMap: store.mapUrl,
  };
  return (
    <div className="wrap home" ref={page}>
      {/* Data for search engines only; never run as code. */}
      <script type="application/ld+json">{JSON.stringify(ld).replace(/</g, '\\u003c')}</script>
      <h1 className="sr-only">Nandam Handlooms: handwoven Mangalagiri sarees</h1>
      {!catalog && status === 'error' ? (
        <div className="empty" role="alert">
          <div className="ico-wrap"><Icon name="wifioff" /></div>
          <h3>We couldn't load the shop</h3>
          <p>Please check your connection and try again.</p>
          <button type="button" className="btn btn-primary" onClick={reload}>Try again</button>
        </div>
      ) : (
        <>
          <CategoryCards catalog={catalog} />
          <CraftStrip catalog={catalog} craft={crafts.length === 1 ? crafts[0] : null} />
          <LatestCollections catalog={catalog} />
          <ShopList title="All sarees" titleTag="h2" labels={{ craft: Object.fromEntries((catalog?.crafts || []).map((c) => [c.key, c.name])) }} />
        </>
      )}
      <Alerts />
    </div>
  );
}
