import Icon from './Icon.jsx';

// A sliding row's arrows and the row itself; the hook (useRail) ties them together.
export function RailNav({ rail: { prevRef, nextRef, go }, label }) {
  return (
    <div className="rail-nav">
      <button type="button" ref={prevRef} onClick={() => go(-1)} aria-label={`Previous ${label}`}><Icon name="left" /></button>
      <button type="button" ref={nextRef} onClick={() => go(1)} aria-label={`Next ${label}`}><Icon name="right" /></button>
    </div>
  );
}

export function Rail({ rail: { ref, barRef }, label, className = '', children }) {
  return (
    <div className="rail-wrap">
      <div className={`rail ${className}`} ref={ref} tabIndex={0} role="region" aria-label={label}>
        {children}
      </div>
      <div className="rail-bar" aria-hidden="true"><i ref={barRef} /></div>
    </div>
  );
}
