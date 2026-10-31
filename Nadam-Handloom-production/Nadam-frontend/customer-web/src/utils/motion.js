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
export function useReveal(ref, deps = []) {
  useEffect(() => {
    const root = ref.current;
    if (!root) return undefined;
    const items = [...root.querySelectorAll('.reveal:not(.in), .wipe:not(.in), .lines:not(.in)')];
    if (prefersReducedMotion() || !('IntersectionObserver' in window)) {
      items.forEach((el) => el.classList.add('in'));
      return undefined;
    }
    const io = new IntersectionObserver((entries) => {
      for (const e of entries) {
        if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); }
      }
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.08 });
    // A clipped (wiped) element never reports as visible: watch its parent instead.
    const subs = [];
    items.forEach((el) => {
      if (!el.classList.contains('wipe')) { io.observe(el); return; }
      const sub = new IntersectionObserver(([e]) => { if (e.isIntersecting) { el.classList.add('in'); sub.disconnect(); } }, { threshold: 0.08 });
      sub.observe(el.parentElement);
      subs.push(sub);
    });
    return () => { io.disconnect(); subs.forEach((s) => s.disconnect()); };
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
