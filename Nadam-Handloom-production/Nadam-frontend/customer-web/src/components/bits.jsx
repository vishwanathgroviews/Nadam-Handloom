import { Link, useNavigate } from 'react-router-dom';
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

// The router numbers this tab's entries on the website (0 = the first page opened here).
const canGoBack = () => (window.history.state?.idx ?? 0) > 0;

// "‹ Back" (owner, 31 Oct 2026): the website opened from the home screen ("Install", "Add to
// Home Screen") has no browser bar, so no back at all. Goes back one page on the website; a page
// opened straight from a link (a shared saree) has nothing here to go back to, so it goes one
// level up (`to`) instead of leaving the website.
export function BackButton({ to = '/' }) {
  const navigate = useNavigate();
  return (
    <button type="button" className="back-btn" onClick={() => (canGoBack() ? navigate(-1) : navigate(to))}>
      <Icon name="left" size="sm" />Back
    </button>
  );
}

// Back on its own, for pages without breadcrumbs (sign-in, not found, loading, couldn't load).
export function BackRow({ to = '/', children = null }) {
  return <div className="crumbs-row"><BackButton to={to} />{children}</div>;
}

// The Back button starts the row; it goes up to the last linked crumb when there is no page to go back to.
export function Crumbs({ items }) {
  const up = [...items].reverse().find(([, to]) => to)?.[1] || '/';
  return (
    <div className="crumbs-row">
      <BackButton to={up} />
      <nav aria-label="Breadcrumb">
        <ol className="crumbs">
          {items.map(([label, to]) => (
            <li key={label}>{to ? <Link to={to}>{label}</Link> : <span aria-current="page">{label}</span>}</li>
          ))}
        </ol>
      </nav>
    </div>
  );
}
