// Pieces of the scan-to-sell screens (Module 5): the bill strip under the camera, a
// bill line with its agreed-price box, the total bar and the big choice buttons.
import { useState } from 'react';
import { Pressable, TextInput, View } from 'react-native';
import { useTheme } from '../../theme/ThemeProvider';
import { Icon } from '../Icon';
import { T } from '../T';
import { Thumb } from '../catalog/Thumb';
import { TagChip } from '../products/TagChip';
import { billTotals, parsePrice, plural, priceText, rupees } from '../../utils/sales';

// Under the camera (owner's pick A): the bill so far; tap to open it.
export function BillStrip({ lines, onPress }) {
  const { c, radius } = useTheme();
  const t = billTotals(lines);
  if (!t.count) {
    return (
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, padding: 13, borderRadius: radius.lg, backgroundColor: c.surface2 }}>
        <Icon name="receipt" size={20} color={c.text2} />
        <View style={{ flex: 1 }}>
          <T variant="bodyStrong">Scan the first saree</T>
          <T variant="small" color="muted">Its store price comes from its subcategory.</T>
        </View>
      </View>
    );
  }
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={`Bill, ${plural(t.count, 'saree')}, ${rupees(t.total)}. View bill`} onPress={onPress}
      style={{ flexDirection: 'row', alignItems: 'center', gap: 10, padding: 13, borderRadius: radius.lg, backgroundColor: c.primary, shadowColor: c.shadow, shadowOpacity: 0.18, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 4 }}>
      <Icon name="receipt" size={20} color={c.onPrimary} />
      <View style={{ flex: 1 }}>
        <T variant="bodyStrong" color={c.onPrimary}>Bill · {plural(t.count, 'saree')} · {rupees(t.total)}</T>
        <T variant="small" color={c.onPrimary} style={{ opacity: 0.85 }}>{t.off > 0 ? `${rupees(t.off)} off · ` : ''}tap to see the bill</T>
      </View>
      <T variant="smallStrong" color={c.onPrimary}>View bill ›</T>
    </Pressable>
  );
}

export function TotalBar({ lines, style }) {
  const { c, radius } = useTheme();
  const t = billTotals(lines);
  return (
    <View accessibilityLabel={`Total ${rupees(t.total)}`} style={[{ flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', gap: 8, padding: 15, borderRadius: radius.lg, backgroundColor: c.surface, borderWidth: 1, borderColor: c.border }, style]}>
      <View>
        <T variant="small" color="muted">{plural(t.count, 'saree')}</T>
        <T variant="heading" style={{ fontVariant: ['tabular-nums'] }}>{rupees(t.total)}</T>
      </View>
      {t.off > 0 ? <T variant="smallStrong" color="success">{rupees(t.off)} off the store price</T> : <T variant="small" color="muted">At store prices</T>}
    </View>
  );
}

// One saree on the bill. The agreed-price box updates the total as you type; leaving
// the box runs the checks (onPriceDone). Empty = the store price.
export function BillLine({ line, editable = true, changed, onRemove, onPriceDone, last }) {
  const { c, radius, type } = useTheme();
  const [text, setText] = useState(priceText(line.agreed));
  const [bad, setBad] = useState(false);
  const bargained = line.agreed != null && line.agreed !== line.storePrice;
  function onChange(v) {
    setText(v);
    const p = parsePrice(v);
    setBad(!!p.error);
    if (!p.error) onPriceDone?.(line, p.value, { typing: true });
  }
  function onEnd() {
    const p = parsePrice(text);
    if (p.error) { setText(priceText(line.agreed)); setBad(false); onPriceDone?.(line, line.agreed, { error: p.error }); return; }
    onPriceDone?.(line, p.value, { done: true, reset: () => setText('') });
  }
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 12, paddingVertical: 11, borderBottomWidth: last ? 0 : 1, borderBottomColor: c.border, backgroundColor: changed ? c.dangerSoft : 'transparent' }}>
      <Thumb uri={line.imageUrl} width={42} height={56} />
      <View style={{ flex: 1, gap: 3 }}>
        <T variant="smallStrong" numberOfLines={1}>{line.name}</T>
        <TagChip code={line.code} />
        {changed ? <T variant="caption" color="danger" style={{ fontFamily: 'PlusJakartaSans_700Bold' }}>{changed}</T> : (
          <T variant="caption" color="muted">
            Store <T variant="caption" color="muted" style={bargained ? { textDecorationLine: 'line-through' } : null}>{rupees(line.storePrice)}</T>
            {line.held ? ' · sold anyway (was held online)' : ''}
          </T>
        )}
      </View>
      <View style={{ width: 108, gap: 2 }}>
        <T variant="caption" color="muted" nativeID={`ap-${line.pieceId}`}>Agreed price</T>
        <View style={{ flexDirection: 'row', alignItems: 'center', borderWidth: 1.5, borderColor: bad ? c.danger : c.borderStrong, borderRadius: radius.sm, backgroundColor: editable ? c.surface : c.surface2, paddingLeft: 8 }}>
          <T variant="bodyStrong" color="muted">₹</T>
          <TextInput value={text} onChangeText={onChange} onEndEditing={onEnd} editable={editable} keyboardType="decimal-pad" returnKeyType="done"
            placeholder={String(line.storePrice)} placeholderTextColor={c.borderStrong} accessibilityLabel={`Agreed price for ${line.code}`} accessibilityLabelledBy={`ap-${line.pieceId}`} maxLength={10}
            style={[type.bodyStrong, { flex: 1, minHeight: 42, paddingHorizontal: 6, color: c.text }]} />
        </View>
      </View>
      {editable ? (
        <Pressable accessibilityRole="button" accessibilityLabel={`Remove ${line.code}`} onPress={() => onRemove?.(line)} hitSlop={6}
          style={{ width: 36, height: 36, borderRadius: 18, borderWidth: 1, borderColor: c.border, backgroundColor: c.surface, alignItems: 'center', justifyContent: 'center' }}>
          <Icon name="x" size={16} color={c.muted} />
        </Pressable>
      ) : null}
    </View>
  );
}

// Where / Paid by / Invoice: big buttons, none chosen at first (6.7).
export function ChoiceGroup({ label, options, value, onChange, error }) {
  const { c, radius } = useTheme();
  return (
    <View accessibilityRole="radiogroup" accessibilityLabel={label} style={{ gap: 7, marginBottom: 16 }}>
      <T variant="label" color="muted">{label}</T>
      <View style={{ flexDirection: 'row', gap: 8 }}>
        {options.map(([v, text, icon]) => {
          const on = value === v;
          return (
            <Pressable key={String(v)} accessibilityRole="radio" accessibilityState={{ checked: on }} accessibilityLabel={`${label}: ${text}`} onPress={() => onChange(v)}
              style={{ flex: 1, minHeight: 62, borderRadius: radius.md, borderWidth: 1.5, borderColor: on ? c.primary : error ? c.danger : c.borderStrong, backgroundColor: on ? c.primarySoft : c.surface, alignItems: 'center', justifyContent: 'center', gap: 3, padding: 6 }}>
              <Icon name={icon} size={20} color={on ? c.primary : c.text2} />
              <T variant="smallStrong" color={on ? 'primary' : 'text2'} style={{ textAlign: 'center' }}>{text}</T>
            </Pressable>
          );
        })}
      </View>
      {error ? <T variant="caption" color="danger" accessibilityRole="alert">{error}</T> : null}
    </View>
  );
}

export function LockNote({ icon = 'lock', text, style }) {
  const { c, radius } = useTheme();
  return (
    <View style={[{ flexDirection: 'row', alignItems: 'center', gap: 8, padding: 12, borderRadius: radius.md, backgroundColor: c.surface2 }, style]}>
      <Icon name={icon} size={18} color={c.text2} />
      <T variant="small" color="text2" style={{ flex: 1 }}>{text}</T>
    </View>
  );
}
