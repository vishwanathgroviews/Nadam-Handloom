// One collection (/category/:slug/:collectionId), in the client's design (26 Oct 2026): its name,
// pieces and price, then all of its sarees with Sets only, sort, the grid size and Load more.
import { Link, useParams } from 'react-router-dom';
import Icon from '../../components/Icon.jsx';
import { Crumbs } from '../../components/bits.jsx';
import ShopList from './ShopList.jsx';
import NotFoundPage from '../info/NotFoundPage.jsx';
import { useCatalog } from '../../data/shop.js';
import { shortName } from '../../data/categories.js';
import { useTitle } from '../../utils/useTitle.js';
import { useMeta } from '../../utils/useMeta.js';
import { num, rs } from '../../utils/money.js';

export default function CollectionPage() {
  const { slug, collectionId } = useParams();
  const { data: catalog, status, reload } = useCatalog();
  const id = (collectionId || '').toLowerCase();
  const col = catalog?.collections.find((c) => c.id === id);
  const cat = catalog?.categories.find((c) => c.slug === (col?.category || slug));
  const craft = catalog?.crafts.find((c) => c.key === col?.craft);
  useTitle(col?.name || 'Collection');
  useMeta(col ? (col.description || `${col.name}: ${num(col.count)} handwoven pieces from Nandam Handlooms, Mangalagiri. ${rs(col.price)} each.`) : undefined, { image: col?.image });

  if (catalog && !col) return <NotFoundPage title="This collection isn't on the website now" text="It may have sold out. See what's new instead." />;
  if (!catalog && status === 'error') {
    return <div className="wrap narrow"><div className="empty" role="alert"><div className="ico-wrap"><Icon name="wifioff" /></div><h3>We couldn't load this collection</h3><p>Please check your connection and try again.</p><button type="button" className="btn btn-primary" onClick={reload}>Try again</button></div></div>;
  }
  return (
    <div className="wrap">
      <div className="chead">
        <Crumbs items={[['Home', '/'], [cat ? shortName(cat) : 'Shop', cat ? `/category/${cat.slug}` : '/shop'], [col?.name || '…']]} />
        {craft ? <span className="eyebrow">{craft.name}</span> : null}
        <h1>{col?.name || ' '}</h1>
        {col ? <p className="meta">{num(col.count)} {col.count === 1 ? 'piece' : 'pieces'} · {rs(col.price)} each{col.sets ? ` · ${num(col.sets)} available as sets` : ''}</p> : null}
        {col?.description ? <p className="desc">{col.description}</p> : null}
      </div>
      {col ? (
        <ShopList
          variant="collection" fixed={{ category: col.category, collection: col.id }} cardLabel="craft" canSets={col.sets > 0}
          empty={<>Everything in this collection has sold out. <Link className="link" to={`/category/${col.category}`}>See the other collections</Link>.</>}
        />
      ) : <div style={{ height: '40vh' }} aria-busy="true" />}
      <div style={{ height: 'clamp(40px, 6vw, 80px)' }} />
    </div>
  );
}
