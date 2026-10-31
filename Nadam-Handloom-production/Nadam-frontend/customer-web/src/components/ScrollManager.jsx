// Where the page sits after moving around the website:
// - a new page starts at the top; a link with #store or #craft goes to that section;
// - Back and Forward return to where the visitor was (once the page has drawn);
// - changing a list's filters or loading more keeps the position.
import { useEffect, useLayoutEffect, useRef } from 'react';
import { useLocation, useNavigationType } from 'react-router-dom';
import { prefersReducedMotion } from '../utils/motion.js';

const positions = new Map(); // history entry -> scrollY
const SETTLE_MS = 1500;
// A section link (#store) keeps its section in place this long while the sections above it
// load their data on a slow connection (stops at once when the visitor scrolls or taps).
const FOLLOW_MS = 6000;
// The page has smooth scrolling on; moving to another page must jump, not glide.
const jump = (y) => window.scrollTo({ top: y, left: 0, behavior: 'instant' });
// Where a section's top should sit: below the sticky header (its CSS scroll-margin-top).
const sectionY = (el) => Math.round(el.getBoundingClientRect().top + window.scrollY - (parseFloat(getComputedStyle(el).scrollMarginTop) || 0));

// Runs `step` every frame until it returns true, the time is up, or the visitor scrolls.
function settle(step, ms = SETTLE_MS) {
  let raf = 0;
  const end = Date.now() + ms;
  const stop = () => { cancelAnimationFrame(raf); ['wheel', 'touchstart', 'keydown', 'pointerdown'].forEach((t) => window.removeEventListener(t, stop)); };
  ['wheel', 'touchstart', 'keydown', 'pointerdown'].forEach((t) => window.addEventListener(t, stop, { passive: true }));
  const tick = () => {
    if (step() || Date.now() > end) { stop(); return; }
    raf = requestAnimationFrame(tick);
  };
  tick();
  return stop;
}

function toY(y) {
  return settle(() => {
    const max = document.documentElement.scrollHeight - window.innerHeight;
    jump(Math.min(y, Math.max(0, max)));
    return max >= y;
  });
}

// Follows the section while the page above it is still growing (data arriving), so the
// visitor lands on it however slow the connection.
function toHash(hash) {
  let id = '';
  try { id = decodeURIComponent(hash.slice(1)); } catch { return null; }
  return settle(() => {
    const el = document.getElementById(id);
    if (!el) return false;
    const max = document.documentElement.scrollHeight - window.innerHeight;
    const top = Math.min(sectionY(el), Math.max(0, max));
    if (Math.abs(window.scrollY - top) > 1) jump(top);
    return false;
  }, FOLLOW_MS);
}

// A link to a section of the page already open ("Our craft" on the home page) glides there.
// If the page above moved during the glide (pictures or data arriving), it finishes the move
// once the glide stops, unless the visitor has started scrolling themselves.
function glide(hash) {
  let el = null;
  try { el = document.getElementById(decodeURIComponent(hash.slice(1))); } catch { /* bad address */ }
  if (!el) return null;
  el.scrollIntoView({ behavior: prefersReducedMotion() ? 'instant' : 'smooth', block: 'start' });
  let lastY = -1;
  let still = 0;
  return settle(() => {
    const y = Math.round(window.scrollY);
    if (y !== lastY) { lastY = y; still = 0; return false; } // still gliding
    still += 1;
    if (still < 8) return false;
    const top = Math.min(sectionY(el), Math.max(0, document.documentElement.scrollHeight - window.innerHeight));
    if (Math.abs(y - top) > 1) { jump(top); still = 0; return false; }
    return still > 30;
  }, FOLLOW_MS);
}

export default function ScrollManager() {
  const { pathname, hash, key } = useLocation();
  const nav = useNavigationType();
  const prevPath = useRef(pathname);
  // The entry being looked at. It moves to the new page before anything scrolls, so the jump
  // to the top of a new page can never overwrite the place kept for the page left behind.
  const current = useRef(key);

  useEffect(() => {
    if ('scrollRestoration' in window.history) window.history.scrollRestoration = 'manual';
    let raf = 0;
    const save = () => { raf = 0; positions.set(current.current, window.scrollY); };
    const on = () => { if (!raf) raf = requestAnimationFrame(save); };
    window.addEventListener('scroll', on, { passive: true });
    return () => { window.removeEventListener('scroll', on); cancelAnimationFrame(raf); };
  }, []);

  useLayoutEffect(() => {
    current.current = key;
    const samePage = prevPath.current === pathname;
    prevPath.current = pathname;
    let stop = null;
    if (nav === 'POP' && positions.has(key)) stop = toY(positions.get(key));
    else if (hash && samePage) stop = glide(hash);
    else if (hash) stop = toHash(hash);
    else if (!samePage) jump(0);
    return () => stop?.();
    // Runs once per history entry.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  return null;
}
