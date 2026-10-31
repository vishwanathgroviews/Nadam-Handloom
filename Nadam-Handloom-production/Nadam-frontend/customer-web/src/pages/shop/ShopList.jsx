// A list of sarees with filters, sort, chosen-filter chips and "Load more" (W3), in the client's
// design (26 Oct 2026). Two layouts:
// - "listing" (home, shop, search, a craft): the title, the count and sort, the filters on the
//   left (a drawer on phones, opened from the bar at the bottom with Sort);
// - "collection" (one collection): a toolbar with Sets only, the count, sort and the grid size.
// Everything is in the address, so Back and shared links show the same list.
import { useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useSearchParams } from 'react-router-dom';
import Icon from '../../components/Icon.jsx';
import SareeCard, { CardSkeletons } from '../../components/SareeCard.jsx';
import Filters from './Filters.jsx';
import { useList, listKey, PAGE } from '../../data/shop.js';
import { useReveal } from '../../utils/motion.js';
import { useDialog } from '../../utils/useDialog.js';
import { num } from '../../utils/money.js';
import { SORTS, readFilters, readPages, withFilters, crafts, isFiltered, groupsFor } from './filters.js';

const COLS_KEY = 'nh-cols';
const readCols = () => { try { return localStorage.getItem(COLS_KEY) === '3' ? 3 : 4; } catch { return 4; } };
const sarees = (n) => `${num(n)} ${n === 1 ? 'saree' : 'sarees'}`;

// The filters on phones (and Sort), over the page.
function Sheet({ id, title, onClose, foot, children }) {
  const ref = useRef(null);
  useDialog(ref, onClose);
  return createPortal(
    <>
      <div className="scrim" onClick={onClose} aria-hidden="true" />
      <div className="drawer sheet" role="dialog" aria-modal="true" aria-labelledby={id} ref={ref}>
        <div className="drawer-head">
          <h2 id={id}>{title}</h2>
          <button type="button" className="btn btn-icon" onClick={onClose} aria-label={`Close ${title.toLowerCase()}`}><Icon name="x" /></button>
        </div>
        <div className="drawer-body">{children}</div>
        {foot ? <div className="drawer-foot">{foot}</div> : null}
      </div>
    </>,
    document.body,
  );
}

export default function ShopList({ fixed = {}, labels = {}, cardLabel = 'collection', empty, title, titleTag: Title = 'h1', intro, variant = 'listing', canSets = true }) {
  const [sp, setSp] = useSearchParams();
  const f = { ...readFilters(sp), ...fixed };
  const pages = readPages(sp);
  const { list: results, retry } = useList(f, pages);
  const [cols, setCols] = useState(readCols);
  const [sheet, setSheet] = useState(null); // null | 'filters' | 'sort'
  const grid = useRef(null);

  const first = results[0];
  // Keep showing the last filter counts while new ones load.
  const [facets, setFacets] = useState(first.data?.facets || null);
  if (first.data && first.data.facets !== facets) setFacets(first.data.facets);

  const items = results.flatMap((r) => r.data?.items || []);
  const total = first.data?.total ?? 0;
  const lastDone = results[results.length - 1];
  const loadingFirst = !first.data && first.status === 'loading';
  const loadingMore = results.length > 1 && !lastDone.data && lastDone.status === 'loading';
  const failed = results.find((r) => r.status === 'error' && !r.data);
  const hasMore = !!lastDone.data && lastDone.data.nextOffset != null;
  // New cards fade in: look again whenever the list changes (other filters, more loaded).
  useReveal(grid, [listKey(f, 0, PAGE), items.length, loadingFirst]);

  const set = (patch) => setSp(withFilters(sp, patch), { replace: true, preventScrollReset: true });
  const clear = () => {
    const next = new URLSearchParams();
    if (sp.get('sort')) next.set('sort', sp.get('sort'));
    setSp(next, { replace: true, preventScrollReset: true });
  };
  const more = () => {
    const next = new URLSearchParams(sp);
    next.set('page', String(pages + 1));
    setSp(next, { replace: true, preventScrollReset: true });
  };
  const chooseCols = (n) => { setCols(n); try { localStorage.setItem(COLS_KEY, String(n)); } catch { /* private mode */ } };

  const groups = groupsFor(facets, f, fixed);
  const label = (key, value) => facets?.[key]?.find((o) => o.key === value)?.label || labels[key]?.[value] || value;
  const chips = [
    ...(f.q && !fixed.q ? [[`Search: “${f.q}”`, { q: '' }]] : []),
    ...(f.category && !fixed.category ? [[label('category', f.category), { category: '', collection: '' }]] : []),
    ...crafts(f).map((c) => [label('craft', c), { craft: crafts(f).filter((x) => x !== c).join(',') }]),
    ...(f.price ? [[label('price', f.price), { price: '' }]] : []),
    ...(f.sets ? [['Sets only', { sets: '' }]] : []),
    ...(f.collection && !fixed.collection ? [[label('collection', f.collection), { collection: '' }]] : []),
  ];
  const filtered = isFiltered(f, fixed);
  const listing = variant === 'listing';
  // Before the counts arrive, guess, so the page doesn't change shape when they do.
  const side = listing && (facets ? groups.length > 0 : true);
  const shown = Math.min(items.length, total);
  const countText = loadingFirst ? 'Loading…' : sarees(total);
  const sortName = (SORTS.find(([k]) => k === f.sort) || SORTS[0])[1];
  const sortSelect = (
    <>
      <label className={listing ? undefined : 'sr-only'} htmlFor="sort">Sort by</label>
      <select id="sort" className="select" value={f.sort} onChange={(e) => set({ sort: e.target.value })}>
        {SORTS.map(([k, t]) => <option key={k} value={k}>{t}</option>)}
      </select>
    </>
  );

  let body;
  if (failed && !items.length) {
    body = (
      <div className="empty" role="alert">
        <div className="ico-wrap"><Icon name="wifioff" /></div>
        <h3>We couldn't load the sarees</h3>
        <p>Please check your connection and try again.</p>
        <button type="button" className="btn btn-primary" onClick={retry}>Try again</button>
      </div>
    );
  } else if (!loadingFirst && total === 0) {
    body = (
      <div className="empty">
        <div className="ico-wrap"><Icon name={f.q ? 'search' : 'filter'} /></div>
        <h3>{f.q && !chips.some(([, p]) => !('q' in p)) ? `Nothing found for “${f.q}”` : 'No sarees match these filters'}</h3>
        <p>{empty || (filtered ? 'Try removing a filter, or see everything in the shop.' : 'New pieces arrive every week. Please check back soon.')}</p>
        {filtered ? <button type="button" className="btn btn-primary" onClick={clear}>Clear filters</button> : null}
      </div>
    );
  } else {
    body = (
      <div className={`pgrid${listing ? '' : ` cgrid c${cols}`}`} ref={grid} aria-busy={loadingFirst || loadingMore || undefined}>
        {loadingFirst ? <CardSkeletons n={8} /> : items.map((c, i) => <SareeCard key={c.slug} card={c} index={i % PAGE} label={cardLabel} eager={i < 4} />)}
        {loadingMore ? <CardSkeletons n={4} /> : null}
      </div>
    );
  }

  const moreRow = items.length && total > 0 ? (
    <div className="more-row">
      <span className="muted small">You've seen {num(shown)} of {num(total)}</span>
      <div className="progress" aria-hidden="true"><i style={{ width: `${total ? (shown / total) * 100 : 0}%` }} /></div>
      {hasMore ? <button type="button" className="btn" onClick={more} disabled={loadingMore}>{loadingMore ? 'Loading…' : 'Load more'}</button> : null}
      {failed && items.length ? <button type="button" className="btn" onClick={retry}>Couldn't load more. Try again</button> : null}
    </div>
  ) : null;

  const chipRow = chips.length ? (
    <div className="active-filters">
      {chips.map(([text, patch]) => (
        <button key={text} type="button" className="chip" onClick={() => set(patch)} aria-label={`Remove filter: ${text}`}>{text}<Icon name="x" size="sm" /></button>
      ))}
      {chips.length > 1 ? <button type="button" className="link small" onClick={clear}>Clear all</button> : null}
    </div>
  ) : null;

  if (!listing) {
    return (
      <div className="clist">
        <div className="ctool">
          <div className="l">
            {canSets || f.sets ? <button type="button" className="chip" aria-pressed={!!f.sets} onClick={() => set({ sets: f.sets ? '' : '1' })}>Sets only</button> : null}
            <span className="count" role="status" aria-live="polite">{countText}</span>
          </div>
          <div className="r">
            {sortSelect}
            <div className="density" role="group" aria-label="Grid size">
              <button type="button" aria-pressed={cols === 3} onClick={() => chooseCols(3)} aria-label="Bigger photos, 3 in a row"><Icon name="cols3" size="sm" /></button>
              <button type="button" aria-pressed={cols === 4} onClick={() => chooseCols(4)} aria-label="Smaller photos, 4 in a row"><Icon name="cols4" size="sm" /></button>
            </div>
          </div>
        </div>
        {body}
        {moreRow}
      </div>
    );
  }

  return (
    <div className="slist">
      <div className="list-head">
        <div>
          {title ? <Title>{title}</Title> : null}
          <p className="count" role="status" aria-live="polite">{countText}</p>
          {intro}
        </div>
        <div className="sortbox">{sortSelect}</div>
      </div>
      {chipRow}
      <div className={`listing${side ? '' : ' no-side'}`}>
        {side ? <aside className="filters" aria-label="Filters">{facets ? <><div className="fh"><b>Filters</b>{chips.length ? <button type="button" className="link small" onClick={clear}>Clear all</button> : null}</div><Filters facets={facets} f={f} groups={groups} set={set} idPrefix="side" /></> : null}</aside> : null}
        <div className="results">
          {body}
          {moreRow}
        </div>
      </div>
      <div className="mob-bar">
        {side ? <button type="button" onClick={() => setSheet('filters')} aria-haspopup="dialog"><Icon name="sliders" />Filter{chips.length ? <small>{chips.length}</small> : null}</button> : null}
        <button type="button" onClick={() => setSheet('sort')} aria-haspopup="dialog"><Icon name="filter" />Sort: {sortName.replace('Price: ', '')}</button>
      </div>

      {sheet === 'filters' ? (
        <Sheet
          id="filters-title" title="Filters" onClose={() => setSheet(null)}
          foot={<><button type="button" className="btn" onClick={clear}>Clear all</button><button type="button" className="btn btn-primary" onClick={() => setSheet(null)}>{loadingFirst ? 'Show sarees' : `Show ${sarees(total)}`}</button></>}
        >
          {facets ? <Filters facets={facets} f={f} groups={groups} set={set} idPrefix="drawer" /> : null}
        </Sheet>
      ) : null}
      {sheet === 'sort' ? (
        <Sheet id="sort-title" title="Sort by" onClose={() => setSheet(null)}>
          <div role="radiogroup" aria-label="Sort by" className="sort-opts">
            {SORTS.map(([k, t]) => (
              <label key={k} className="check"><input type="radio" name="sort-sheet" checked={f.sort === k} onChange={() => { set({ sort: k }); setSheet(null); }} /><span>{t}</span></label>
            ))}
          </div>
        </Sheet>
      ) : null}
    </div>
  );
}
