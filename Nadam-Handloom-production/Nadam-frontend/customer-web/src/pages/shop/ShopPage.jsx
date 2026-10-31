// All sarees (/shop): every list in one place — search results, a craft, sets, new in.
import { useSearchParams } from 'react-router-dom';
import { Crumbs } from '../../components/bits.jsx';
import ShopList from './ShopList.jsx';
import { useCatalog } from '../../data/shop.js';
import { useTitle } from '../../utils/useTitle.js';
import { useMeta } from '../../utils/useMeta.js';
import { readFilters, crafts } from './filters.js';

function heading(f, sp, catalog) {
  const craftList = crafts(f);
  if (f.q) return [`Results for “${f.q}”`, 'Search'];
  if (f.sets) return ['Sets for the family', 'Several identical pieces of one design, for sisters, mothers and daughters, or a family function.'];
  if (craftList.length === 1) {
    const c = catalog?.crafts.find((x) => x.key === craftList[0]);
    if (c) return [c.name, `Every ${c.name.toLowerCase()} piece across our collections.`];
  }
  if (f.category) {
    const c = catalog?.categories.find((x) => x.slug === f.category);
    if (c) return [c.name, c.description];
  }
  if (sp.get('sort') === 'new') return ['New in', 'The newest pieces from the store, added the day they arrive.'];
  return ['All sarees', 'Handwoven in Mangalagiri: pattu sarees, dress materials and more.'];
}

export default function ShopPage() {
  const [sp] = useSearchParams();
  const { data: catalog } = useCatalog();
  const f = readFilters(sp);
  const [title, text] = heading(f, sp, catalog);
  useTitle(title);
  useMeta(f.q ? undefined : text);
  return (
    <div className="wrap">
      <Crumbs items={[['Home', '/'], [f.q ? 'Search' : title]]} />
      <ShopList
        title={title} intro={text && !f.q ? <p className="muted intro">{text}</p> : null}
        labels={{ craft: Object.fromEntries((catalog?.crafts || []).map((c) => [c.key, c.name])) }}
      />
    </div>
  );
}
