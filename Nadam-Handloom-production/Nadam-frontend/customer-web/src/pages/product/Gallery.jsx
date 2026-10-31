// The saree's photos (design B): large, zoom under the pointer on computers, tap for the
// full-screen view (swipe, arrow keys, Escape).
import { useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import Icon from '../../components/Icon.jsx';
import { useDialog } from '../../utils/useDialog.js';

const canHover = () => window.matchMedia?.('(hover: hover) and (pointer: fine)').matches;

function Lightbox({ photos, start, onClose }) {
  const [i, setI] = useState(start);
  const ref = useRef(null);
  const n = photos.length;
  const go = (d) => setI((x) => (x + d + n) % n);
  useDialog(ref, onClose, { onKey: (e) => { if (e.key === 'ArrowRight') go(1); if (e.key === 'ArrowLeft') go(-1); } });
  const touch = useRef(null);
  return createPortal(
    <div
      className="lightbox"
      role="dialog"
      aria-modal="true"
      aria-label={`Photo ${i + 1} of ${n}`}
      ref={ref}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      onTouchStart={(e) => { touch.current = e.touches[0].clientX; }}
      onTouchEnd={(e) => {
        if (touch.current == null) return;
        const dx = e.changedTouches[0].clientX - touch.current;
        touch.current = null;
        if (Math.abs(dx) > 50 && n > 1) go(dx < 0 ? 1 : -1);
      }}
    >
      <img src={photos[i].url} alt={photos[i].alt} />
      <button type="button" className="btn btn-icon x" onClick={onClose} aria-label="Close photo" data-autofocus><Icon name="x" /></button>
      {n > 1 ? (
        <>
          <button type="button" className="btn btn-icon nav prev" onClick={() => go(-1)} aria-label="Previous photo"><Icon name="left" /></button>
          <button type="button" className="btn btn-icon nav next" onClick={() => go(1)} aria-label="Next photo"><Icon name="right" /></button>
          <span className="lb-count" aria-hidden="true">{i + 1} / {n}</span>
        </>
      ) : null}
    </div>,
    document.body,
  );
}

function Stage({ photo, index, total, onOpen }) {
  const [zoom, setZoom] = useState(false);
  const [broken, setBroken] = useState(false);
  const move = (e) => {
    const r = e.currentTarget.getBoundingClientRect();
    e.currentTarget.style.setProperty('--zx', `${((e.clientX - r.left) / r.width) * 100}%`);
    e.currentTarget.style.setProperty('--zy', `${((e.clientY - r.top) / r.height) * 100}%`);
  };
  return (
    <button
      type="button"
      className={`stage${zoom ? ' zooming' : ''}`}
      onClick={() => onOpen(index)}
      onMouseEnter={() => { if (canHover()) setZoom(true); }}
      onMouseLeave={() => setZoom(false)}
      onMouseMove={zoom ? move : undefined}
      aria-label={`Open photo ${index + 1} of ${total} full screen`}
     
    >
      {broken ? <span className="ph-missing"><Icon name="thread" /></span> : (
        <img src={photo.url} alt={photo.alt} loading={index === 0 ? 'eager' : 'lazy'} fetchPriority={index === 0 ? 'high' : undefined} decoding="async" onError={() => setBroken(true)} />
      )}
      {index === 0 ? <span className="hint" aria-hidden="true"><Icon name="zoom" size="sm" /> Hover to zoom · click for full screen</span> : null}
    </button>
  );
}

export default function Gallery({ photos }) {
  const [open, setOpen] = useState(null);
  if (!photos.length) return <div className="gallery single"><div className="stage"><span className="ph-missing"><Icon name="thread" /></span></div></div>;
  return (
    <div className={`gallery${photos.length === 1 ? ' single' : ''}`}>
      {photos.map((p, i) => <Stage key={p.url} photo={p} index={i} total={photos.length} onOpen={setOpen} />)}
      {open != null ? <Lightbox photos={photos} start={open} onClose={() => setOpen(null)} /> : null}
    </div>
  );
}
