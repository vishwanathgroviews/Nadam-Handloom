// Motion helpers for the shop pages. Everything respects the visitor's "reduce motion" setting:
// then content simply appears, nothing moves with the scroll and nothing plays by itself.
import { useEffect, useSyncExternalStore } from 'react';

const query = typeof window !== 'undefined' && window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : null;
export const prefersReducedMotion = () => !!query?.matches;
const subscribe = (fn) => { query?.addEventListener?.('change', fn); return () => query?.removeEventListener?.('change', fn); };
export const useReducedMotion = () => useSyncExternalStore(subscribe, prefersReducedMotion, () => false);

// Marks <html> so CSS knows whether to animate (".js-motion") or not (".no-motion").
export function applyMotionClass() {
  const root = document.documentElement;
  const off = prefersReducedMotion();
  root.classList.toggle('js-motion', !off);
  root.classList.toggle('no-motion', off);
}
if (typeof window !== 'undefined') {
  applyMotionClass();
  query?.addEventListener?.('change', applyMotionClass);
}

// Adds "in" to .reveal, .wipe and .lines elements inside `ref` as they come into view.
// deps: re-scan when the content changes (e.g. data arrived).
// It also watches the content itself (31 Oct 2026), so nothing is left invisible:
// - elements added later are picked up even when deps don't change (a refreshed list with
//   new sarees on top still has 24 cards);
// - an element that came in stays in when React rewrites its class (a card's "added" after
//   Add to bag replaced the whole class, "in" included, and the card vanished).
const REVEAL = '.reveal, .wipe, .lines';

export function useReveal(ref, deps = []) {
  useEffect(() => {
    const root = ref.current;
    if (!root) return undefined;
    const instant = prefersReducedMotion() || !('IntersectionObserver' in window);
    const shown = new WeakSet();
    const show = (el) => { shown.add(el); el.classList.add('in'); };
    const io = instant ? null : new IntersectionObserver((entries) => {
      for (const e of entries) {
        if (e.isIntersecting) { show(e.target); io.unobserve(e.target); }
      }
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.08 });
    const subs = [];
    const watch = (el) => {
      if (el.classList.contains('in')) { shown.add(el); return; }
      if (instant) { show(el); return; }
      if (!el.classList.contains('wipe')) { io.observe(el); return; }
      // A clipped (wiped) element never reports as visible: watch its parent instead.
      const sub = new IntersectionObserver(([e]) => { if (e.isIntersecting) { show(el); sub.disconnect(); } }, { threshold: 0.08 });
      sub.observe(el.parentElement);
      subs.push(sub);
    };
    root.querySelectorAll(REVEAL).forEach(watch);
    // Runs before the next paint, so a class rewrite never shows as a flicker.
    const mo = new MutationObserver((records) => {
      for (const r of records) {
        if (r.type === 'attributes') {
          if (shown.has(r.target) && !r.target.classList.contains('in')) r.target.classList.add('in');
          continue;
        }
        r.addedNodes.forEach((n) => {
          if (n.nodeType !== 1) return;
          if (n.matches(REVEAL)) watch(n);
          n.querySelectorAll(REVEAL).forEach(watch);
        });
      }
    });
    mo.observe(root, { childList: true, subtree: true, attributes: true, attributeFilter: ['class'] });
    return () => { mo.disconnect(); io?.disconnect(); subs.forEach((s) => s.disconnect()); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
}

// Calls fn(scrollY) once per frame while scrolling (and once at the start). Off with reduce
// motion, unless `always` (state that follows the scroll without moving anything).
export function useScrollFrame(fn, deps = [], { always = false } = {}) {
  useEffect(() => {
    if (!always && prefersReducedMotion()) return undefined;
    let raf = 0;
    const run = () => { raf = 0; fn(window.scrollY); };
    const on = () => { if (!raf) raf = requestAnimationFrame(run); };
    window.addEventListener('scroll', on, { passive: true });
    window.addEventListener('resize', on);
    on();
    return () => { window.removeEventListener('scroll', on); window.removeEventListener('resize', on); cancelAnimationFrame(raf); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
}
