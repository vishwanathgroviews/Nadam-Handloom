import { Link } from 'react-router-dom';
import Icon from './Icon.jsx';
import { initials } from '../utils/format.js';

export function Avatar({ name, url, size = 64 }) {
  return (
    <span className="avatar" style={{ width: size, height: size, fontSize: Math.round(size * 0.38) }} aria-hidden="true">
      {url ? <img src={url} alt="" width={size} height={size} /> : initials(name)}
    </span>
  );
}

// An on/off switch with its own accessible name.
export function Toggle({ checked, onChange, label, disabled, id }) {
  return (
    <label className="tgl">
      <input id={id} type="checkbox" role="switch" checked={!!checked} disabled={disabled} aria-checked={!!checked} onChange={(e) => onChange(e.target.checked)} />
      <span aria-hidden="true" />
      <span className="sr-only">{label}</span>
    </label>
  );
}

export function EmptyState({ icon = 'info', title, text, children }) {
  return (
    <div className="empty">
      <div className="ico-wrap"><Icon name={icon} /></div>
      <h3>{title}</h3>
      {text ? <p>{text}</p> : null}
      {children}
    </div>
  );
}

export const Skeleton = ({ h = 120, style }) => <div className="skel" style={{ height: h, ...style }} aria-hidden="true" />;

export function Crumbs({ items }) {
  return (
    <nav aria-label="Breadcrumb">
      <ol className="crumbs">
        {items.map(([label, to]) => (
          <li key={label}>{to ? <Link to={to}>{label}</Link> : <span aria-current="page">{label}</span>}</li>
        ))}
      </ol>
    </nav>
  );
}
