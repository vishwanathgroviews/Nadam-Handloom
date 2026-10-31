// Every collection (/collections), grouped by category, with a craft filter.
import { useRef } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Crumbs } from '../../components/bits.jsx';
import CollectionTile, { TileSkeletons } from '../../components/CollectionTile.jsx';
import { useCatalog } from '../../data/shop.js';
import { useReveal } from '../../utils/motion.js';
import { useTitle } from '../../utils/useTitle.js';
import { useMeta } from '../../utils/useMeta.js';
import { num } from '../../utils/money.js';

export default function CollectionsPage() {
  useTitle('All collections');
  useMeta('Every Nandam Handlooms collection: Mangalagiri pattu sarees, embroidery, kalamkari, prints, dress materials and more.');
  const { data: catalog, status, reload } = useCatalog();
  const [sp, setSp] = useSearchParams();
  const box = useRef(null);
  const craft = catalog?.crafts.some((c) => c.key === sp.get('craft')) ? sp.get('craft') : '';
  const cols = (catalog?.collections || []).filter((c) => !craft || c.craft === craft);
  useReveal(box, [cols.length, craft]);
  const pick = (key) => setSp(key ? { craft: key } : {}, { replace: true, preventScrollReset: true });

  return (
    <div className="wrap" ref={box}>
      <div className="page-head">
        <Crumbs items={[['Home', '/'], ['All collections']]} />
        <h1>All collections</h1>
        <p className="muted" style={{ maxWidth: '60ch' }}>{catalog ? `${catalog.totals.collections} collections, ${num(catalog.totals.sarees)} pieces in stock. ` : ''}Each collection is one design, woven in many colours.</p>
      </div>
      {catalog ? (
        <div className="chip-row" role="group" aria-label="Filter by craft">
          <button type="button" className="chip" aria-pressed={!craft} onClick={() => pick('')}>All <span className="n">{catalog.totals.collections}</span></button>
          {catalog.crafts.map((c) => (
            <button key={c.key} type="button" className="chip" aria-pressed={craft === c.key} onClick={() => pick(c.key)}>{c.name} <span className="n">{c.collections}</span></button>
          ))}
        </div>
      ) : null}
      {!catalog && status === 'error' ? (
        <div className="empty" role="alert"><h3>We couldn't load the collections</h3><p>Please check your connection.</p><button type="button" className="btn btn-primary" onClick={reload}>Try again</button></div>
      ) : null}
      {!catalog && status !== 'error' ? <div className="ccols" aria-busy="true"><TileSkeletons n={8} /></div> : null}
      {catalog?.categories.map((cat) => {
        const list = cols.filter((c) => c.category === cat.slug);
        if (!list.length) return null;
        return (
          <section key={cat.slug} className="section tight" aria-labelledby={`h-${cat.slug}`}>
            <div className="sec-head">
              <div><span className="eyebrow">{list.length} {list.length === 1 ? 'collection' : 'collections'}</span><h2 id={`h-${cat.slug}`}>{cat.name}</h2></div>
              <Link className="lux-link" to={`/category/${cat.slug}`}>Shop all {num(cat.count)}</Link>
            </div>
            <ul className="ccols" aria-label={`${cat.name}: collections`}>{list.map((c, i) => <li key={c.id}><CollectionTile c={c} index={i} /></li>)}</ul>
          </section>
        );
      })}
      <div style={{ height: 'clamp(32px, 5vw, 64px)' }} />
    </div>
  );
}
