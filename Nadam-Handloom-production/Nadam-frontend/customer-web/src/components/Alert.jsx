import Icon from './Icon.jsx';

const ICON = { info: 'info', ok: 'check', warn: 'alert', bad: 'alertc' };

// tone: info | ok | warn | bad. Errors and warnings are announced to screen readers.
export default function Alert({ tone = 'info', title, children, actions, icon }) {
  return (
    <div className={`alert${tone === 'info' ? '' : ` alert-${tone}`}`} role={tone === 'bad' || tone === 'warn' ? 'alert' : 'status'}>
      <Icon name={icon || ICON[tone]} />
      <div>
        {title ? <b className="alert-title">{title}</b> : null}
        {children}
        {actions ? <div className="acts">{actions}</div> : null}
      </div>
    </div>
  );
}
