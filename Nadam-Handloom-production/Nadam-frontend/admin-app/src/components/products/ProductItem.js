// A saree in a list: a row with its photo (the default), or a photo-grid cell like
// the website's product card. Name, SKU, tag numbers, stock and the store price.
import { Image, Pressable, View } from 'react-native';
import { useTheme } from '../../theme/ThemeProvider';
import { Badge } from '../Bits';
import { Icon } from '../Icon';
import { T } from '../T';
import { TagChip } from './TagChip';
import { channelText, stockBadge } from '../../utils/products';
import { rupees } from '../../utils/catalog';

function Photo({ uri, width, height, radius = 8 }) {
  const { c } = useTheme();
  return (
    <View style={{ width, height, borderRadius: radius, overflow: 'hidden', backgroundColor: c.surface3, alignItems: 'center', justifyContent: 'center' }}>
      {uri ? <Image source={{ uri }} style={{ width: '100%', height: '100%' }} resizeMode="cover" accessibilityIgnoresInvertColors /> : <Icon name="image" size={20} color={c.muted} />}
    </View>
  );
}

const liveTags = (p) => p.tags.filter((t) => t.status !== 'retired');
// A set (several identical sarees on one listing): "Set of 5", or "Set of 5 · 3 left".
function setText(tags) {
  if (tags.length < 2) return null;
  const left = tags.filter((t) => t.status === 'in_stock').length;
  return `Set of ${tags.length}${left && left < tags.length ? ` · ${left} left` : ''}`;
}

export function ProductRow({ p, onPress, last }) {
  const { c } = useTheme();
  const [stock, tone] = stockBadge(p.stock);
  const tags = liveTags(p);
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={`${p.name}, ${tags.map((t) => t.code).join(', ')}, ${stock}`} onPress={onPress} android_ripple={{ color: c.surface2 }}
      style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 14, paddingVertical: 11, borderBottomWidth: last ? 0 : 1, borderBottomColor: c.border }}>
      <Photo uri={p.imageUrl} width={44} height={58} />
      <View style={{ flex: 1, minWidth: 0, gap: 3 }}>
        <T variant="bodyStrong" numberOfLines={1}>{p.name}</T>
        <T variant="caption" color="muted" numberOfLines={1}>{p.sku}</T>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 5, alignItems: 'center' }}>
          {tags.slice(0, 2).map((t) => <TagChip key={t.code} code={t.code} tone={t.status.startsWith('sold') ? 'sold' : 'plain'} />)}
          {tags.length > 2 ? <T variant="caption" color="muted">+{tags.length - 2}</T> : null}
          <Badge text={stock} tone={tone} />
          {setText(tags) ? <Badge text={setText(tags)} tone="owner" /> : null}
          {p.channel !== 'both' ? <Badge text={channelText(p.channel)} tone="neutral" /> : null}
          {!p.imageUrl ? <Badge text="No photo" tone="warning" /> : null}
          {p.bestSeller ? <Badge text="Best Seller" tone="staff" /> : null}
        </View>
      </View>
      <View style={{ alignItems: 'flex-end' }}>
        <T variant="smallStrong">{rupees(p.storePrice)}</T>
        <T variant="caption" color="muted">Web {rupees(p.websitePrice)}</T>
      </View>
    </Pressable>
  );
}

export function ProductCell({ p, onPress, width }) {
  const { c, radius } = useTheme();
  const [stock, tone] = stockBadge(p.stock);
  const tags = liveTags(p);
  const tag = tags[0];
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={`${p.name}, ${tag?.code || ''}, ${stock}`} onPress={onPress}
      style={{ width, borderRadius: radius.lg, borderWidth: 1, borderColor: c.border, backgroundColor: c.surface, overflow: 'hidden' }}>
      <View>
        <Photo uri={p.imageUrl} width="100%" height={(width * 4) / 3} radius={0} />
        <View style={{ position: 'absolute', left: 6, top: 6, gap: 4, alignItems: 'flex-start' }}><Badge text={stock} tone={tone} />{setText(tags) ? <Badge text={setText(tags)} tone="owner" /> : null}</View>
      </View>
      <View style={{ padding: 9, gap: 2 }}>
        <T variant="smallStrong" numberOfLines={2}>{p.name}</T>
        <T variant="caption" color="muted" numberOfLines={1}>{tag ? `${tag.code} · ` : ''}{rupees(p.storePrice)}</T>
      </View>
    </Pressable>
  );
}
