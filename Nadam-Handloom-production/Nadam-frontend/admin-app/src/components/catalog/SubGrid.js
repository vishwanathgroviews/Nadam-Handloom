// Subcategories as the website shows sarees (client's request, 23 Oct 2026): a big photo in the
// saree's own shape (3:4), two side by side on a phone (three on a tablet), with the name,
// counts, badges, store and website price under it. Used by a category and by the search.
import { Image, Pressable, View, useWindowDimensions } from 'react-native';
import { useTheme } from '../../theme/ThemeProvider';
import { Badge } from '../Bits';
import { Icon } from '../Icon';
import { T } from '../T';
import { plural, rupees } from '../../utils/catalog';

const GAP = 12;
const PAGE_PADDING = 20; // the screen's own padding on each side
const MAX_WIDTH = 760; // the screens' widest content

// How many cards in a row, and how wide each is, for this screen.
export function gridSize(screenWidth) {
  const inner = Math.min(screenWidth, MAX_WIDTH) - PAGE_PADDING * 2;
  const columns = inner >= 560 ? 3 : 2;
  return { columns, cardWidth: Math.floor((inner - GAP * (columns - 1)) / columns) };
}

export function SubCard({ s, showCategory, onPress, width }) {
  const { c, radius } = useTheme();
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={`${s.name}, store ${rupees(s.storePrice)}, website ${rupees(s.websitePrice)}${!s.showOnWebsite ? ', hidden' : ''}${!s.hasPhoto ? ', needs photo' : ''}`}
      onPress={onPress} android_ripple={{ color: c.surface2 }}
      style={({ pressed }) => ({ width, borderRadius: radius.md, overflow: 'hidden', backgroundColor: c.surface, borderWidth: 1, borderColor: c.border, opacity: pressed ? 0.85 : 1 })}>
      <View style={{ width: '100%', aspectRatio: 3 / 4, backgroundColor: c.surface3, alignItems: 'center', justifyContent: 'center' }}>
        {s.imageUrl ? <Image testID={`sub-photo-${s.id}`} source={{ uri: s.imageUrl }} style={{ width: '100%', height: '100%' }} resizeMode="cover" accessibilityIgnoresInvertColors /> : <Icon name="image" size={34} color={c.muted} strokeWidth={1.4} />}
        {!s.showOnWebsite || !s.hasPhoto ? (
          <View style={{ position: 'absolute', top: 8, left: 8, gap: 4 }}>
            {!s.showOnWebsite ? <Badge text="Hidden" tone="warning" /> : null}
            {!s.hasPhoto ? <Badge text="Needs photo" tone="neutral" /> : null}
          </View>
        ) : null}
      </View>
      <View style={{ padding: 10, gap: 2 }}>
        {showCategory ? <T variant="caption" color="muted" numberOfLines={1} style={{ textTransform: 'uppercase', letterSpacing: 0.4 }}>{s.categoryName}</T> : null}
        <T variant="bodyStrong" numberOfLines={2}>{s.name}</T>
        {/* Narrow cards: the counts may take a second line rather than be cut off. */}
        <T variant="small" color="muted" numberOfLines={2}>{plural(s.productCount, 'product')}{s.inStockCount ? ` · ${s.inStockCount} in stock` : ''}</T>
        <View style={{ flexDirection: 'row', alignItems: 'baseline', flexWrap: 'wrap', columnGap: 6, marginTop: 4 }}>
          <T variant="bodyStrong">{rupees(s.storePrice)}</T>
          <T variant="caption" color="muted">Web {rupees(s.websitePrice)}</T>
        </View>
      </View>
    </Pressable>
  );
}

// items: the subcategories in order; onOpen(s) opens one.
export function SubGrid({ items, showCategory, onOpen }) {
  const { width } = useWindowDimensions();
  const { cardWidth } = gridSize(width);
  return (
    <View accessibilityRole="list" style={{ flexDirection: 'row', flexWrap: 'wrap', gap: GAP }}>
      {items.map((s) => <SubCard key={s.id} s={s} showCategory={showCategory} width={cardWidth} onPress={() => onOpen(s)} />)}
    </View>
  );
}
