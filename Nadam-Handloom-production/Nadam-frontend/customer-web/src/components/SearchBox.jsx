import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import Icon from './Icon.jsx';
import { useCatalog } from '../data/shop.js';
import { shopApi } from '../api/shop.js';
import { CRAFT_NAMES, wordMeansCraft } from '../data/crafts.js';
import { num, rs } from '../utils/money.js';

// The search bar in the header. As you type: crafts and collections that match, and the first
// sarees (by name, collection or code); Enter shows every result.
export default function SearchBox() {
  const navigate = useNavigate();
  const { pathname, search } = useLocation();
  const { data: catalog } = useCatalog();
  const urlQ = pathname === '/shop' ? (new URLSearchParams(search).get('q') || '') : '';
  const [q, setQ] = useState(urlQ);
  const [open, setOpen] = useState(false);
  const [res, setRes] = useState({ q: '', items: [] });
  const form = useRef(null);
  const term = q.trim();

  // A new page: the box shows that page's search (or nothing) and the suggestions close.
  const page = `${pathname}?${urlQ}`;
  const [seen, setSeen] = useState(page);
  if (seen !== page) { setSeen(page); setQ(urlQ); setOpen(false); }

  useEffect(() => {
    if (!open || term.length < 2) return undefined;
    const ctrl = new AbortController();
    const t = setTimeout(() => {
      shopApi.products(new URLSearchParams({ q: term, limit: '4' }).toString(), { signal: ctrl.signal })
        .then((r) => setRes({ q: term, items: r.items }))
        .catch(() => { if (!ctrl.signal.aborted) setRes({ q: term, items: [] }); });
    }, 250);
    return () => { clearTimeout(t); ctrl.abort(); };
  }, [term, open]);

  useEffect(() => {
    if (!open) return undefined;
    const away = (e) => { if (!form.current?.contains(e.target)) setOpen(false); };
    document.addEventListener('pointerdown', away);
    return () => document.removeEventListener('pointerdown', away);
  }, [open]);

  const { crafts, cols } = useMemo(() => {
    if (!catalog || term.length < 2) return { crafts: [], cols: [] };
    const words = term.toLowerCase().split(/\s+/);
    return {
      crafts: catalog.crafts.filter((k) => words.every((w) => wordMeansCraft(w, k.key))).slice(0, 2),
      cols: catalog.collections.filter((c) => words.every((w) => c.name.toLowerCase().includes(w) || wordMeansCraft(w, c.craft))).slice(0, 4),
    };
  }, [catalog, term]);
  const items = res.q === term ? res.items : [];
  const showing = open && term.length >= 2;

  const go = (e) => {
    e.preventDefault();
    setOpen(false);
    form.current?.querySelector('input')?.blur();
    if (term) navigate(`/shop?q=${encodeURIComponent(term)}`);
  };
  // Arrow keys move through the suggestions; Escape closes them.
  const onKey = (e) => {
    const links = [...(form.current?.querySelectorAll('.suggest a') || [])];
    const at = links.indexOf(document.activeElement);
    // The first Escape only closes the suggestions (the browser would also empty the box).
    if (e.key === 'Escape') { if (showing) e.preventDefault(); setOpen(false); form.current?.querySelector('input')?.focus(); return; }
    if (e.key === 'ArrowDown' && links.length) { e.preventDefault(); links[Math.min(links.length - 1, at + 1)].focus(); }
    if (e.key === 'ArrowUp' && links.length) { e.preventDefault(); if (at <= 0) form.current?.querySelector('input')?.focus(); else links[at - 1].focus(); }
  };
  const close = () => setOpen(false);

  return (
    <form className="search" role="search" onSubmit={go} onKeyDown={onKey} ref={form} autoComplete="off">
      <label className="sr-only" htmlFor="site-search">Search sarees, crafts or a code</label>
      <Icon name="search" />
      <input
        id="site-search" type="search" value={q} enterKeyHint="search" placeholder="Search sarees, crafts, codes…"
        onChange={(e) => { setQ(e.target.value); setOpen(true); }} onFocus={() => setOpen(true)}
        aria-autocomplete="list" aria-controls="search-suggest" aria-expanded={showing}
      />
      <button className="go" type="submit">Search</button>
      {showing ? (
        <div className="suggest" id="search-suggest">
          {crafts.length ? <span className="h">Crafts</span> : null}
          {crafts.map((k) => <Link key={k.key} to={`/shop?craft=${k.key}`} onClick={close}>{CRAFT_NAMES[k.key]}<small>{num(k.count)}</small></Link>)}
          {cols.length ? <span className="h">Collections</span> : null}
          {cols.map((c) => <Link key={c.id} to={`/category/${c.category}/${c.id}`} onClick={close}>{c.name}<small>{num(c.count)}</small></Link>)}
          {items.length ? <span className="h">Sarees</span> : null}
          {items.map((p) => (
            <Link key={p.slug} to={`/product/${p.slug}`} onClick={close}>
              {p.photo ? <img src={p.photo.url} alt="" loading="lazy" /> : <span className="ph-missing" />}
              <span className="nm">{p.name}<span className="muted small"> · {p.sku}</span></span>
              <small>{rs(p.price)}</small>
            </Link>
          ))}
          <Link className="all" to={`/shop?q=${encodeURIComponent(term)}`} onClick={close}><b>See all results for “{term}”</b><Icon name="arrow" size="sm" /></Link>
        </div>
      ) : null}
    </form>
  );
}
