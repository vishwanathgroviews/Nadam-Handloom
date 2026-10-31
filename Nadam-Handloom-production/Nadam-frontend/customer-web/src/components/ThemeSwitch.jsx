import Icon from './Icon.jsx';
import { setThemePref, useThemePref } from '../theme/theme.js';

const OPTIONS = [['auto', 'contrast', 'Auto'], ['light', 'sun', 'Light'], ['dark', 'moon', 'Dark']];

// Auto (follows the device), Light or Dark.
export default function ThemeSwitch() {
  const pref = useThemePref();
  return (
    <div className="theme-seg" role="group" aria-label="Colour theme">
      {OPTIONS.map(([v, icon, label]) => (
        <button key={v} type="button" aria-pressed={pref === v} onClick={() => setThemePref(v)}>
          <Icon name={icon} size="sm" />
          {label}
        </button>
      ))}
    </div>
  );
}
