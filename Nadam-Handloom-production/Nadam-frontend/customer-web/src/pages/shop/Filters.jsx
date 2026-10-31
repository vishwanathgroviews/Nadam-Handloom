// The filter groups (left column on computers, a drawer on phones). Counts come from the
// server and already allow for the other filters chosen.
import { useId, useState } from 'react';
import Icon from '../../components/Icon.jsx';
import { num } from '../../utils/money.js';
import { crafts } from './filters.js';
import { shortName } from '../../data/categories.js';

const SHOW_COLLECTIONS = 8;

function Group({ title, children, open: startOpen = true }) {
  const [open, setOpen] = useState(startOpen);
  const id = useId();
  return (
    <div className="fgroup">
      <button type="button" aria-expanded={open} aria-controls={id} onClick={() => setOpen((o) => !o)}>{title}<Icon name="down" size="sm" /></button>
      <div className="opts" id={id} hidden={!open} role="group" aria-label={title}>{children}</div>
    </div>
  );
}

function Option({ type, name, checked, onChange, label, count }) {
  return (
    <label className={`check${count === 0 && !checked ? ' zero' : ''}`}>
      <input type={type} name={name} checked={checked} onChange={onChange} />
      <span>{label}</span>
      {count != null ? <span className="cnt">{num(count)}</span> : null}
    </label>
  );
}

export default function Filters({ facets, f, groups, set, idPrefix }) {
  const [allCols, setAllCols] = useState(false);
  const chosen = crafts(f);
  const toggleCraft = (key) => {
    const next = chosen.includes(key) ? chosen.filter((k) => k !== key) : [...chosen, key];
    set({ craft: next.sort().join(',') });
  };
  const cols = (facets.collection || []).filter((o) => o.count > 0 || o.key === f.collection);
  const shownCols = allCols ? cols : cols.slice(0, SHOW_COLLECTIONS);
  return (
    <>
      {groups.includes('category') ? (
        <Group title="Category">
          <Option type="radio" name={`${idPrefix}-cat`} checked={!f.category} onChange={() => set({ category: '', collection: '' })} label="All" />
          {facets.category.map((o) => (
            <Option key={o.key} type="radio" name={`${idPrefix}-cat`} checked={f.category === o.key} onChange={() => set({ category: o.key, collection: '' })} label={shortName({ slug: o.key, name: o.label })} count={o.count} />
          ))}
        </Group>
      ) : null}
      {groups.includes('craft') ? (
        <Group title="Craft">
          {facets.craft.map((o) => (
            <Option key={o.key} type="checkbox" checked={chosen.includes(o.key)} onChange={() => toggleCraft(o.key)} label={o.label} count={o.count} />
          ))}
        </Group>
      ) : null}
      {groups.includes('price') ? (
        <Group title="Price">
          <Option type="radio" name={`${idPrefix}-price`} checked={!f.price} onChange={() => set({ price: '' })} label="Any price" />
          {facets.price.map((o) => (
            <Option key={o.key} type="radio" name={`${idPrefix}-price`} checked={f.price === o.key} onChange={() => set({ price: o.key })} label={o.label} count={o.count} />
          ))}
        </Group>
      ) : null}
      <div className="fgroup">
        <label className="check">
          <input type="checkbox" checked={!!f.sets} onChange={() => set({ sets: f.sets ? '' : '1' })} />
          <span>Sets only<span className="muted small" style={{ display: 'block' }}>More than one identical piece in stock</span></span>
        </label>
      </div>
      {groups.includes('collection') ? (
        <Group title="Collection" open={!!f.collection}>
          <Option type="radio" name={`${idPrefix}-col`} checked={!f.collection} onChange={() => set({ collection: '' })} label="All collections" />
          {shownCols.map((o) => (
            <Option key={o.key} type="radio" name={`${idPrefix}-col`} checked={f.collection === o.key} onChange={() => set({ collection: o.key })} label={o.label} count={o.count} />
          ))}
          {cols.length > SHOW_COLLECTIONS ? (
            <button type="button" className="link small" style={{ justifySelf: 'start' }} onClick={() => setAllCols((v) => !v)}>
              {allCols ? 'Show fewer' : `Show all ${cols.length}`}
            </button>
          ) : null}
        </Group>
      ) : null}
    </>
  );
}
