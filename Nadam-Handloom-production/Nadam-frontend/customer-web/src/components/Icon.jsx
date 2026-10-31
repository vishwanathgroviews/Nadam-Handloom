import { ICONS } from './icons.js';

// A line icon from the design kit. Decorative unless given a label.
export default function Icon({ name, size, className = '', label }) {
  const cls = ['ico', size === 'sm' ? 'ico-sm' : size === 'lg' ? 'ico-lg' : '', className].filter(Boolean).join(' ');
  return (
    <svg
      className={cls}
      viewBox="0 0 24 24"
      aria-hidden={label ? undefined : 'true'}
      role={label ? 'img' : undefined}
      aria-label={label}
      focusable="false"
      // Fixed markup from icons.js only.
      dangerouslySetInnerHTML={{ __html: ICONS[name] || ICONS.info }}
    />
  );
}
