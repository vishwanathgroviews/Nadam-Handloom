import { forwardRef } from 'react';
import Icon from './Icon.jsx';

// kind: primary | ghost | danger | (plain). While `loading`, it can't be pressed twice.
const Button = forwardRef(function Button({ kind, size, block, loading, icon, children, className = '', type = 'button', disabled, ...rest }, ref) {
  const cls = ['btn', kind ? `btn-${kind}` : '', size ? `btn-${size}` : '', block ? 'btn-block' : '', loading ? 'is-loading' : '', className].filter(Boolean).join(' ');
  return (
    <button ref={ref} type={type} className={cls} disabled={disabled} aria-busy={loading || undefined} aria-disabled={loading || undefined} {...rest}>
      {icon ? <Icon name={icon} size="sm" /> : null}
      {children}
    </button>
  );
});
export default Button;
