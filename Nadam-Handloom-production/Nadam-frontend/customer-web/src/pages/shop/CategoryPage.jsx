// A category (/category/:slug), in the client's design (26 Oct 2026): a slim banner, then every
// collection (subcategory) of it as a photo; one opens its sarees. A category with nothing on
// the website yet says "Coming soon", with the collections the shop is adding and WhatsApp.
import { useRef } from 'react';
import { Link, useParams } from 'react-router-dom';
import Icon from '../../components/Icon.jsx';
import { BackRow, Crumbs } from '../../components/bits.jsx';
import CategoryPhoto from '../../components/CategoryPhoto.jsx';
import CollectionTile, { TileSkeletons } from '../../components/CollectionTile.jsx';
import NotFoundPage from '../info/NotFoundPage.jsx';
import { useCatalog } from '../../data/shop.js';
import { allCategories, bannerPhoto, collectionsOf, shortName, SOON } from '../../data/categories.js';
import { useConfig } from '../../config/useConfig.js';
import { useReveal } from '../../utils/motion.js';
import { useTitle } from '../../utils/useTitle.js';
import { useMeta } from '../../utils/useMeta.js';
import { num } from '../../utils/money.js';

const many = (n, one, more) => `${num(n)} ${n === 1 ? one : more}`;

function ComingSoon({ cat, catalog }) {
  const { config } = useConfig();
  const name = shortName(cat);
  const wa = `https://wa.me/${config.store.whatsapp}?text=${encodeURIComponent(`Hello, do you have ${name.toLowerCase()}? Please send photos.`)}`;
  const others = allCategories(catalog).filter((c) => !c.soon);
  return (
    <div className="empty soon-box">
      <div className="ico-wrap"><Icon name="spark" /></div>
      <h2>{name}: new pieces coming soon</h2>
      <p>We're adding them to the website. Ask us on WhatsApp and we'll send photos of what's in the store.</p>
      {cat.upcoming.length ? <ul className="chips" aria-label="Collections on the way">{cat.upcoming.map((x) => <li key={x} className="chip">{x}</li>)}</ul> : null}
      <a className="btn btn-wa" href={wa} target="_blank" rel="noopener noreferrer"><Icon name="whatsapp" size="sm" />Ask on WhatsApp</a>
      {others.length ? <p className="small">Or see: {others.map((c, i) => <span key={c.slug}>{i ? ' · ' : ''}<Link className="link" to={`/category/${c.slug}`}>{shortName(c)}</Link></span>)}</p> : null}
    </div>
  );
}

export default function CategoryPage() {
  const { slug } = useParams();
  const { data: catalog, status, reload } = useCatalog();
  const box = useRef(null);
  const cat = allCategories(catalog).find((c) => c.slug === slug);
  const cols = collectionsOf(catalog, slug);
  useReveal(box, [slug, cols.length]);
  useTitle(cat?.name || 'Category');
  useMeta(cat?.description, { image: cat?.image });

  if (catalog && !cat) return <NotFoundPage title="This category isn't on the website now" />;
  if (!catalog && status === 'error') {
    return <div className="wrap narrow"><BackRow /><div className="empty" role="alert"><div className="ico-wrap"><Icon name="wifioff" /></div><h3>We couldn't load the collections</h3><p>Please check your connection and try again.</p><button type="button" className="btn btn-primary" onClick={reload}>Try again</button></div></div>;
  }
  return (
    <div ref={box}>
      <div className="cbanner">
        {cat ? <CategoryPhoto photo={bannerPhoto(cat)} sizes="100vw" priority /> : null}
        <div className="wrap">
          <div className="in">
            <Crumbs items={[['Home', '/'], [cat?.name || '…']]} />
            <span className="eyebrow">{!cat ? 'Category' : cat.soon ? SOON : `${many(cat.count, 'piece', 'pieces')} · ${many(cat.collections, 'collection', 'collections')}`}</span>
            <h1>{cat?.name || ' '}</h1>
            {cat?.description ? <p>{cat.description}</p> : null}
          </div>
        </div>
      </div>
      <div className="wrap">
        {cat?.soon ? <ComingSoon cat={cat} catalog={catalog} /> : (
          <section aria-labelledby="h-cols">
            <div className="choose">
              <div><span className="eyebrow">Choose a collection</span><h2 id="h-cols">{cat ? many(cols.length, 'collection', 'collections') : 'Collections'}</h2></div>
              {cols.length ? <p>{cols.length > 1 ? 'The most pieces first · tap one to see its sarees' : 'Tap it to see its sarees'}</p> : null}
            </div>
            {cat ? (
              <ul className="ccols" aria-label="Collections">{cols.map((c, i) => <li key={c.id}><CollectionTile c={c} index={i} /></li>)}</ul>
            ) : (
              <div className="ccols" aria-busy="true"><TileSkeletons n={8} /></div>
            )}
          </section>
        )}
        <div style={{ height: 'clamp(32px, 5vw, 64px)' }} />
      </div>
    </div>
  );
}
