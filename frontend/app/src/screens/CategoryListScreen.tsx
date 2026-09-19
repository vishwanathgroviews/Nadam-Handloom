import React, { useCallback, useState } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, Image } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { AppStackParamList } from '../navigation/RootNavigator';
import { useAuth } from '../context/AuthContext';
import { listCategories, AdminCategory } from '../api/catalog';
import { saveToCache, loadFromCache } from '../utils/offlineCache';
import OfflineBanner from '../components/OfflineBanner';
import ScreenHeader from '../components/ui/ScreenHeader';
import { SkeletonList } from '../components/ui/Skeleton';
import Card from '../components/ui/Card';
import { colors, radius, spacing, typography } from '../utils/theme';

type Props = NativeStackScreenProps<AppStackParamList, 'Categories'>;

const CACHE_KEY = 'categories';

export default function CategoryListScreen({ navigation }: Props) {
  const { accessToken } = useAuth();
  const [categories, setCategories] = useState<AdminCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [offlineSince, setOfflineSince] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!accessToken) return;
    setLoading(true);
    setError('');
    try {
      const res = await listCategories(accessToken);
      setCategories(res.data);
      setOfflineSince(null);
      saveToCache(CACHE_KEY, res.data);
    } catch (err: any) {
      const cached = await loadFromCache<AdminCategory[]>(CACHE_KEY);
      if (cached) {
        setCategories(cached.data);
        setOfflineSince(cached.savedAt);
      } else {
        setError(err.message || 'Failed to load categories');
      }
    } finally {
      setLoading(false);
    }
  }, [accessToken]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  return (
    <View style={styles.container}>
      <ScreenHeader
        title="Categories"
        subtitle="Categories are just name, description, and photo. Open one to manage its subcategories — that's where price, description, and Hide/Unhide live."
        rightAction={
          <TouchableOpacity style={styles.addButton} onPress={() => navigation.navigate('CategoryForm', {})} activeOpacity={0.8}>
            <Text style={styles.addButtonText}>+ New</Text>
          </TouchableOpacity>
        }
      />

      {offlineSince && <OfflineBanner cachedAt={offlineSince} />}

      {loading ? (
        <SkeletonList count={5} variant="media" />
      ) : error ? (
        <Text style={styles.error}>{error}</Text>
      ) : (
        <FlatList
          data={categories}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ paddingBottom: 40 }}
          showsVerticalScrollIndicator={false}
          renderItem={({ item }) => (
            <TouchableOpacity onPress={() => navigation.navigate('CategoryForm', { categoryId: item.id })} activeOpacity={0.8}>
              <Card style={styles.cardMain}>
                {item.imageUrl ? (
                  <Image source={{ uri: item.imageUrl }} style={styles.thumb} />
                ) : (
                  <View style={[styles.thumb, styles.thumbPlaceholder]}>
                    <Ionicons name="image-outline" size={18} color={colors.iconMuted} />
                  </View>
                )}
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={styles.cardTitle} numberOfLines={1}>{item.name}</Text>
                  <Text style={styles.cardMeta} numberOfLines={1}>
                    {item._count?.subcategories ?? 0} subcategor{item._count?.subcategories === 1 ? 'y' : 'ies'} · {item._count?.products ?? 0} product{item._count?.products === 1 ? '' : 's'}
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color={colors.iconMuted} />
              </Card>
            </TouchableOpacity>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background, padding: spacing.md },
  addButton: {
    backgroundColor: colors.primaryBg,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  addButtonText: { ...typography.bodySmSemibold, color: colors.primary },
  cardMain: { flexDirection: 'row', alignItems: 'center', padding: spacing.md, gap: spacing.md, marginBottom: spacing.sm + 2 },
  thumb: { width: 52, height: 52, borderRadius: radius.md, backgroundColor: colors.placeholderBg },
  thumbPlaceholder: { alignItems: 'center', justifyContent: 'center' },
  cardTitle: { ...typography.bodySemibold, color: colors.text },
  cardMeta: { ...typography.bodySm, color: colors.textMuted, marginTop: 3 },
  error: {
    color: colors.error,
    backgroundColor: colors.errorBg,
    padding: spacing.sm + 2,
    borderRadius: radius.md,
    marginTop: spacing.md,
    fontSize: 13,
  },
});
