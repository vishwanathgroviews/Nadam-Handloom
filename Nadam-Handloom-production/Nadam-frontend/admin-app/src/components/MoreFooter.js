// Under a list that comes 20 at a time: a spinner while the next 20 load, "Show more"
// when there are more (in case they didn't load by themselves), "Try again" if loading
// failed, and "That's all …" at the end of a long list.
import { ActivityIndicator, View } from 'react-native';
import { useTheme } from '../theme/ThemeProvider';
import { Button } from './Button';
import { T } from './T';

export function MoreFooter({ paged, allText }) {
  const { c } = useTheme();
  if (paged.more) return <ActivityIndicator style={{ marginVertical: 16 }} color={c.primary} accessibilityLabel="Loading more" />;
  if (paged.moreError) {
    return (
      <View style={{ alignItems: 'center', gap: 6, marginTop: 12 }}>
        <T variant="caption" color="danger">Couldn&apos;t load more. {paged.moreError.message}</T>
        <Button title="Try again" kind="secondary" small icon="refresh" onPress={paged.loadMore} />
      </View>
    );
  }
  if (paged.hasMore) return <Button title="Show more" kind="secondary" small onPress={paged.loadMore} style={{ marginTop: 12, alignSelf: 'center' }} />;
  if (allText && paged.items.length > 20) return <T variant="caption" color="muted" style={{ textAlign: 'center', marginTop: 12 }}>{allText}</T>;
  return null;
}
