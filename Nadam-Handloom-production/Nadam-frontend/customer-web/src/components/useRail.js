import { useEffect, useRef } from 'react';

// A sliding row: swipe on phones, drag with a mouse, arrows, and a thin progress line.
export function useRail() {
  const ref = useRef(null);
  const barRef = useRef(null);
  const prevRef = useRef(null);
  const nextRef = useRef(null);
  useEffect(() => {
    const r = ref.current;
    if (!r) return undefined;
    const paint = () => {
      const max = r.scrollWidth - r.clientWidth;
      const w = r.scrollWidth ? (r.clientWidth / r.scrollWidth) * 100 : 100;
      if (barRef.current) { barRef.current.style.width = `${w}%`; barRef.current.style.left = `${max > 0 ? (r.scrollLeft / max) * (100 - w) : 0}%`; }
      if (prevRef.current) prevRef.current.disabled = r.scrollLeft < 4;
      if (nextRef.current) nextRef.current.disabled = r.scrollLeft > max - 4;
    };
    let down = false; let moved = false; let sx = 0; let sl = 0;
    const onDown = (e) => { if (e.pointerType !== 'mouse' || e.button) return; down = true; moved = false; sx = e.clientX; sl = r.scrollLeft; };
    const onMove = (e) => {
      if (!down) return;
      const dx = e.clientX - sx;
      if (Math.abs(dx) > 5 && !moved) { moved = true; r.classList.add('dragging'); }
      if (moved) r.scrollLeft = sl - dx;
    };
    const onUp = () => { if (!down) return; down = false; setTimeout(() => r.classList.remove('dragging'), 0); };
    const onClick = (e) => { if (moved) { e.preventDefault(); e.stopPropagation(); moved = false; } };
    r.addEventListener('scroll', paint, { passive: true });
    r.addEventListener('pointerdown', onDown);
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    r.addEventListener('click', onClick, true);
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(paint) : null;
    ro?.observe(r);
    paint();
    return () => {
      r.removeEventListener('scroll', paint);
      r.removeEventListener('pointerdown', onDown);
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      r.removeEventListener('click', onClick, true);
      ro?.disconnect();
    };
  }, []);
  const go = (dir) => ref.current?.scrollBy({ left: dir * ref.current.clientWidth * 0.85, behavior: 'smooth' });
  return { ref, barRef, prevRef, nextRef, go };
}
