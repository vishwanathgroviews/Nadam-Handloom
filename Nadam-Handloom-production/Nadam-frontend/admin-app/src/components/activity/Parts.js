// Pieces of the Activity log (Module 10, pick A: rows with coloured icons): the kind's
// tile, one row, and the sheet with an entry's details.
import { Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../theme/ThemeProvider';
import { Badge } from '../Bits';
import { Button } from '../Button';
import { Icon } from '../Icon';
import { T } from '../T';
import { KIND_ICON, KIND_TONE, LINK_WORD, linkHref } from '../../utils/activity';

export function KindTile({ kind, size = 36 }) {
  const { c, radius } = useTheme();
  const tones = { primary: [c.primarySoft, c.primary], info: [c.infoSoft, c.info], accent: [c.accentSoft, c.accent], success: [c.successSoft, c.success], neutral: [c.surface3, c.text2], warning: [c.warningSoft, c.warning], danger: [c.dangerSoft, c.danger] };
  const [bg, fg] = tones[KIND_TONE[kind]] || tones.neutral;
  return <View style={{ width: size, height: size, borderRadius: radius.md, backgroundColor: bg, alignItems: 'center', justifyContent: 'center' }}><Icon name={KIND_ICON[kind] || 'info'} size={size / 2} color={fg} /></View>;
}

export function EntryRow({ e, onPress, last }) {
  const { c } = useTheme();
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={`${e.important ? 'Important. ' : ''}${e.text}. ${e.time}`} onPress={onPress} android_ripple={{ color: c.surface2 }}>
      <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 12, paddingHorizontal: 14, paddingVertical: 12, borderBottomWidth: last ? 0 : 1, borderBottomColor: c.border, borderLeftWidth: 3, borderLeftColor: e.important ? c.warning : 'transparent' }}>
        <KindTile kind={e.kind} />
        <View style={{ flex: 1, gap: 3 }}>
          <T variant="smallStrong">{e.text}</T>
          <T variant="caption" color="muted">{e.time}{e.phone ? ` · ${e.phone}` : ''}</T>
          {e.group ? <T variant="caption" color="primary" style={{ fontFamily: 'PlusJakartaSans_700Bold' }}>{e.count} entries</T> : null}
        </View>
        {e.important ? <Icon name="alert" size={16} color={c.warning} /> : null}
      </View>
    </Pressable>
  );
}

export function EntrySheet({ e, onClose }) {
  const { c, radius } = useTheme();
  const insets = useSafeAreaInsets();
  if (!e) return null;
  const href = linkHref(e.link);
  const facts = [['Who', e.actor?.name || 'Not recorded'], ['When', `${e.date}, ${e.time}`], ['Phone', e.phone || 'Not recorded'], ...(e.details || [])];
  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <View style={{ flex: 1, backgroundColor: c.overlay, justifyContent: 'flex-end', padding: 12, paddingBottom: Math.max(insets.bottom, 12) }}>
        {/* The dark background closes the sheet; it sits behind the sheet, so drags inside the sheet always scroll it. */}
        <Pressable accessibilityLabel="Close" onPress={onClose} style={StyleSheet.absoluteFill} />
        <View style={{ backgroundColor: c.surface, borderRadius: radius.xl, padding: 18, width: '100%', maxWidth: 520, alignSelf: 'center', maxHeight: '85%' }}>
          <ScrollView contentContainerStyle={{ gap: 10 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <KindTile kind={e.kind} />
              {e.important ? <Badge text="Important" tone="warning" /> : null}
            </View>
            <T variant="barTitle">{e.text}</T>
            <View style={{ gap: 8 }}>
              {facts.map(([k, v]) => (
                <View key={k} style={{ flexDirection: 'row', gap: 10 }}>
                  <T variant="small" color="muted" style={{ width: 110 }}>{k}</T>
                  <T variant="smallStrong" style={{ flex: 1 }}>{v}</T>
                </View>
              ))}
            </View>
            <View style={{ gap: 8, marginTop: 6 }}>
              {href ? <Button title={`Open ${LINK_WORD[e.link.type]}`} onPress={() => { onClose(); router.push(href); }} /> : null}
              <Button title="Close" kind="secondary" onPress={onClose} />
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}
