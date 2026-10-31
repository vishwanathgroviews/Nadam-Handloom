// Reorder categories, or a category's subcategories (owners): drag a row by its handle,
// or use ▲ ▼. Saved together with "Save order" (decision 5.5).
import { useCallback, useMemo, useState } from 'react';
import { Animated, PanResponder, Pressable, ScrollView, View } from 'react-native';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { TopBar } from '../../../../components/Screen';
import { T } from '../../../../components/T';
import { Button } from '../../../../components/Button';
import { Banner } from '../../../../components/Banner';
import { Icon } from '../../../../components/Icon';
import { useFeedback } from '../../../../components/Feedback';
import { Thumb } from '../../../../components/catalog/Thumb';
import { OwnersOnly } from '../../../../components/team/OwnersOnly';
import { useTheme } from '../../../../theme/ThemeProvider';
import { useTabBarSpace } from '../../../../hooks/useTabBarSpace';
import * as catalog from '../../../../api/catalog';
import { allPages } from '../../../../hooks/usePaged';

const ROW_H = 68;

// One row; dragging its handle moves it, and on release it lands where it was dropped.
function DragRow({ item, index, count, onMove, onDragState }) {
  const { c, radius } = useTheme();
  const [dy] = useState(() => new Animated.Value(0));
  const [dragging, setDragging] = useState(false);
  const pan = useMemo(() => PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: () => true,
    onPanResponderGrant: () => { setDragging(true); onDragState(true); },
    onPanResponderMove: Animated.event([null, { dy }], { useNativeDriver: false }),
    onPanResponderTerminationRequest: () => false,
    onPanResponderRelease: (_e, g) => {
      const to = Math.max(0, Math.min(count - 1, index + Math.round(g.dy / ROW_H)));
      dy.setValue(0); setDragging(false); onDragState(false);
      if (to !== index) onMove(index, to);
    },
    onPanResponderTerminate: () => { dy.setValue(0); setDragging(false); onDragState(false); },
  }), [index, count, dy, onMove, onDragState]);

  return (
    <Animated.View style={{ height: ROW_H, flexDirection: 'row', alignItems: 'center', gap: 10, paddingRight: 10, backgroundColor: dragging ? c.primarySoft : c.surface, borderBottomWidth: 1, borderBottomColor: c.border, transform: [{ translateY: dy }], zIndex: dragging ? 2 : 0, elevation: dragging ? 6 : 0, borderRadius: dragging ? radius.md : 0 }}>
      <View {...pan.panHandlers} accessibilityLabel={`Drag to move ${item.name}`} style={{ width: 44, height: ROW_H, alignItems: 'center', justifyContent: 'center' }}>
        <Icon name="grip" size={22} color={c.muted} />
      </View>
      <T variant="caption" color="muted" style={{ width: 20, textAlign: 'right' }}>{index + 1}</T>
      <Thumb uri={item.imageUrl} width={46} height={36} />
      <T variant="bodyStrong" numberOfLines={2} style={{ flex: 1 }}>{item.name}</T>
      <Pressable accessibilityRole="button" accessibilityLabel={`Move ${item.name} up`} disabled={index === 0} onPress={() => onMove(index, index - 1)} hitSlop={4}
        style={{ width: 36, height: 36, borderRadius: 8, borderWidth: 1, borderColor: c.border, alignItems: 'center', justifyContent: 'center', opacity: index === 0 ? 0.35 : 1 }}>
        <Icon name="up" size={16} color={c.text2} />
      </Pressable>
      <Pressable accessibilityRole="button" accessibilityLabel={`Move ${item.name} down`} disabled={index === count - 1} onPress={() => onMove(index, index + 1)} hitSlop={4}
        style={{ width: 36, height: 36, borderRadius: 8, borderWidth: 1, borderColor: c.border, alignItems: 'center', justifyContent: 'center', opacity: index === count - 1 ? 0.35 : 1 }}>
        <Icon name="down" size={16} color={c.text2} />
      </Pressable>
    </Animated.View>
  );
}

export default function Reorder() {
  const { cat } = useLocalSearchParams();
  const { c, radius } = useTheme();
  const insets = useSafeAreaInsets();
  const space = useTabBarSpace();
  const { showToast } = useFeedback();
  const [items, setItems] = useState(null);
  const [problem, setProblem] = useState(null);
  const [busy, setBusy] = useState(false);
  const [scrolling, setScrolling] = useState(true);
  const [forbidden, setForbidden] = useState(false);

  // Loads the current order. A message about a failed save stays on screen after it.
  const load = useCallback(async () => {
    try {
      // The whole list (every page of 20): the new order covers them all.
      if (cat) setItems((await allPages((offset) => catalog.getCategory(cat, { offset }), 'subcategories')).map(({ id, name, imageUrl }) => ({ id, name, imageUrl })));
      else setItems((await allPages((offset) => catalog.listCategories(offset), 'categories')).map(({ id, name, imageUrl }) => ({ id, name, imageUrl })));
    } catch (e) { setProblem(e); }
  }, [cat]);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const move = useCallback((from, to) => setItems((list) => {
    const next = [...list];
    const [it] = next.splice(from, 1);
    next.splice(to, 0, it);
    return next;
  }), []);
  const onDragState = useCallback((d) => setScrolling(!d), []);

  async function save() {
    setBusy(true);
    try {
      const ids = items.map((i) => i.id);
      if (cat) await catalog.reorderSubcategories(cat, ids);
      else await catalog.reorderCategories(ids);
      router.back();
      showToast('New order saved · the website shows it now', 'success');
    } catch (e) {
      if (e.code === 'FORBIDDEN') setForbidden(true);
      else if (e.code === 'ORDER_OUT_OF_DATE') { setProblem(e); load(); }
      else setProblem(e);
    } finally { setBusy(false); }
  }

  if (forbidden) return <OwnersOnly />;
  return (
    <View style={{ flex: 1, backgroundColor: c.bg, paddingTop: insets.top }}>
      <View style={{ width: '100%', maxWidth: 680, alignSelf: 'center' }}>
        <TopBar title={cat ? 'Reorder subcategories' : 'Reorder categories'} onBack={() => router.back()} right={<Button title="Cancel" kind="ghost" small onPress={() => router.back()} style={{ marginRight: 8 }} />} />
      </View>
      <ScrollView scrollEnabled={scrolling} contentContainerStyle={{ padding: 20, paddingTop: 4, paddingBottom: space.scroll + 70, width: '100%', maxWidth: 680, alignSelf: 'center' }}>
        <T color="text2" style={{ marginBottom: 12 }}>Drag by the handle, or use ▲ ▼. Customers see this order on the website.</T>
        {problem ? <Banner tone="error" title={problem.code === 'ORDER_OUT_OF_DATE' ? 'The list changed on another phone' : 'Couldn\'t save the order'} text={problem.code === 'ORDER_OUT_OF_DATE' ? 'It has been reloaded. Make your changes again.' : problem.message} style={{ marginBottom: 12 }} /> : null}
        {items ? (
          <View style={{ borderRadius: radius.lg, borderWidth: 1, borderColor: c.border, backgroundColor: c.surface }}>
            {items.map((it, i) => <DragRow key={it.id} item={it} index={i} count={items.length} onMove={move} onDragState={onDragState} />)}
          </View>
        ) : <View style={{ height: 240, borderRadius: 14, backgroundColor: c.surface3, opacity: 0.6 }} />}
      </ScrollView>
      <View style={{ position: 'absolute', left: 0, right: 0, bottom: space.footer + 16, paddingHorizontal: 20, width: '100%', maxWidth: 680, alignSelf: 'center' }}>
        <Button title="Save order" loading={busy} disabled={!items} onPress={save} />
      </View>
    </View>
  );
}
