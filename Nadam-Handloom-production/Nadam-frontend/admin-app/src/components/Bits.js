// Small shared pieces: step bar, PIN rule list, badge, avatar, list rows, facts, progress.
import { Pressable, View } from 'react-native';
import { useTheme } from '../theme/ThemeProvider';
import { Icon } from './Icon';
import { T } from './T';

export function StepBar({ step, total }) {
  const { c } = useTheme();
  return (
    <View accessibilityLabel={`Step ${step} of ${total}`} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 14 }}>
      <View style={{ flex: 1, flexDirection: 'row', gap: 4 }}>
        {Array.from({ length: total }, (_, i) => <View key={i} style={{ flex: 1, height: 4, borderRadius: 4, backgroundColor: i < step ? c.primary : c.surface3 }} />)}
      </View>
      <T variant="caption" color="muted">Step {step} of {total}</T>
    </View>
  );
}

export function RuleList({ rules }) {
  const { c } = useTheme();
  return (
    <View style={{ gap: 7, marginTop: 12 }} accessibilityLabel="PIN rules">
      {rules.map((r) => {
        const color = r.ok === true ? c.success : r.ok === false ? c.danger : c.muted;
        return (
          <View key={r.key} style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
            <Icon name={r.ok === true ? 'check' : r.ok === false ? 'x' : 'more'} size={17} color={color} />
            <T variant={r.ok === false ? 'smallStrong' : 'small'} color={color}>{r.label}</T>
          </View>
        );
      })}
    </View>
  );
}

export function Badge({ text, tone = 'neutral' }) {
  const { c, radius } = useTheme();
  const map = {
    owner: [c.primarySoft, c.primary], staff: [c.accentSoft, c.accent], success: [c.successSoft, c.success],
    warning: [c.warningSoft, c.warning], danger: [c.dangerSoft, c.danger], neutral: [c.surface2, c.text2], planned: ['transparent', c.muted],
  };
  const [bg, fg] = map[tone] || map.neutral;
  return (
    <View style={{ alignSelf: 'flex-start', paddingHorizontal: 9, paddingVertical: 3, borderRadius: radius.pill, backgroundColor: bg, borderWidth: tone === 'planned' ? 1 : 0, borderStyle: 'dashed', borderColor: c.borderStrong }}>
      <T variant="caption" color={fg} style={{ fontFamily: 'PlusJakartaSans_700Bold' }}>{text}</T>
    </View>
  );
}

// Up to two initials from words that start with a letter ("Admin 8565" -> "A", "(test)" skipped).
export const initials = (name) => String(name || '').split(/\s+/).filter((w) => /^\p{L}/u.test(w)).map((w) => w[0]).join('').slice(0, 2).toUpperCase() || '?';

export function Avatar({ name, size = 46, muted = false }) {
  const { c } = useTheme();
  return (
    <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: muted ? c.surface3 : c.primarySoft, alignItems: 'center', justifyContent: 'center' }}>
      <T variant={size > 50 ? 'heading' : 'bodyStrong'} color={muted ? 'muted' : 'primary'}>{initials(name)}</T>
    </View>
  );
}

export function Card({ children, style }) {
  const { c, radius } = useTheme();
  return <View style={[{ backgroundColor: c.surface, borderColor: c.border, borderWidth: 1, borderRadius: radius.lg, overflow: 'hidden' }, style]}>{children}</View>;
}

// title may be text or an element (e.g. a name with badges); leading replaces the icon tile.
export function Row({ icon, leading, title, subtitle, right, onPress, last = false, accessibilityLabel }) {
  const { c, radius } = useTheme();
  const body = (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 13, borderBottomWidth: last ? 0 : 1, borderBottomColor: c.border }}>
      {leading || (icon ? <View style={{ width: 40, height: 40, borderRadius: radius.md, backgroundColor: c.surface2, alignItems: 'center', justifyContent: 'center' }}><Icon name={icon} size={20} color={c.text2} /></View> : null)}
      <View style={{ flex: 1 }}>
        {typeof title === 'string' ? <T variant="bodyStrong">{title}</T> : title}
        {subtitle ? <T variant="small" color="muted">{subtitle}</T> : null}
      </View>
      {right !== undefined ? right : onPress ? <Icon name="right" size={18} color={c.muted} /> : null}
    </View>
  );
  const label = accessibilityLabel || (typeof title === 'string' ? title : undefined);
  return onPress ? <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress} android_ripple={{ color: c.surface2 }}>{body}</Pressable> : body;
}

export function SectionLabel({ children }) {
  return <T variant="label" color="muted" style={{ marginTop: 22, marginBottom: 8, marginLeft: 4 }}>{children}</T>;
}

export function Facts({ items, style }) {
  const { c, radius } = useTheme();
  return (
    <View style={[{ gap: 10, padding: 16, borderRadius: radius.lg, backgroundColor: c.surface, borderColor: c.border, borderWidth: 1, alignSelf: 'stretch' }, style]}>
      {items.map((text) => (
        <View key={text} style={{ flexDirection: 'row', gap: 10, alignItems: 'flex-start' }}>
          <Icon name="check" size={18} color={c.success} />
          <T variant="small" color="text2" style={{ flex: 1 }}>{text}</T>
        </View>
      ))}
    </View>
  );
}

export function Progress({ fraction, tone = 'primary', style }) {
  const { c } = useTheme();
  const color = { primary: c.primary, warning: c.warning, danger: c.danger }[tone];
  return (
    <View style={[{ height: 6, borderRadius: 6, backgroundColor: c.surface3, overflow: 'hidden' }, style]}>
      <View style={{ width: `${Math.max(0, Math.min(1, fraction)) * 100}%`, height: '100%', backgroundColor: color, borderRadius: 6 }} />
    </View>
  );
}

export function MessageIcon({ name, tone = 'primary' }) {
  const { c } = useTheme();
  const [bg, fg] = { primary: [c.primarySoft, c.primary], warning: [c.warningSoft, c.warning], danger: [c.dangerSoft, c.danger], success: [c.successSoft, c.success] }[tone];
  return (
    <View style={{ width: 92, height: 92, borderRadius: 46, backgroundColor: bg, alignItems: 'center', justifyContent: 'center', alignSelf: 'center', marginTop: 28, marginBottom: 18 }}>
      <Icon name={name} size={44} color={fg} strokeWidth={1.6} />
    </View>
  );
}
