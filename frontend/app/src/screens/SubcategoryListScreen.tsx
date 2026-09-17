import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, ActivityIndicator, Image, TextInput, Keyboard } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { AppStackParamList } from '../navigation/RootNavigator';
import { useAuth } from '../context/AuthContext';
import { listSubcategories, AdminSubcategory } from '../api/catalog';
import {
  addRecentSearch,
  clearRecentSearches,
  loadRecentSearches,
  recentSearchesKey,
  saveRecentSearches,
} from '../utils/recentSearches';
import ScreenHeader from '../components/ui/ScreenHeader';
import Card from '../components/ui/Card';
import { Badge } from '../components/ui/Chip';
import { colors, radius, spacing, typography } from '../utils/theme';

type Props = NativeStackScreenProps<AppStackParamList, 'SubcategoryList'>;

export default function SubcategoryListScreen({ route, navigation }: Props) {
  const { categoryId, categoryName } = route.params;
  const { accessToken, user } = useAuth();
  const [subcategories, setSubcategories] = useState<AdminSubcategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const [searchFocused, setSearchFocused] = useState(false);
  const blurTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const recentsKey = recentSearchesKey(user?.id, categoryId);

  useEffect(() => {
    let cancelled = false;
    loadRecentSearches(recentsKey).then((list) => {
      if (!cancelled) setRecentSearches(list);
    });
    return () => {
      cancelled = true;
    };
  }, [recentsKey]);

  useEffect(() => () => {
    if (blurTimer.current) clearTimeout(blurTimer.current);
  }, []);

  // A search is remembered once it was actually used — submitted, or followed
  // by opening one of its results — not on every keystroke, which would fill
  // the list with half-typed fragments like "pa" and "pat".
  const rememberSearch = useCallback(
    (term: string) => {
      if (!term.trim()) return;
      setRecentSearches((prev) => {
        const next = addRecentSearch(prev, term);
        saveRecentSearches(recentsKey, next);
        return next;
      });
    },
    [recentsKey]
  );

  const pickRecentSearch = useCallback(
    (term: string) => {
      setQuery(term);
      rememberSearch(term);
      setSearchFocused(false);
      Keyboard.dismiss();
    },
    [rememberSearch]
  );

  const handleClearRecents = useCallback(() => {
    setRecentSearches([]);
    clearRecentSearches(recentsKey);
  }, [recentsKey]);

  // Shown the moment the search box is tapped, while it is still empty —
  // once the person starts typing, the live results take over.
  const showRecents = searchFocused && !query.trim() && recentSearches.length > 0;

  const load = useCallback(async () => {
    if (!accessToken) return;
    setLoading(true);
    setError('');
    try {
      const res = await listSubcategories(accessToken, categoryId);
      setSubcategories(res.data);
    } catch (err: any) {
      setError(err.message || 'Failed to load subcategories');
    } finally {
      setLoading(false);
    }
  }, [accessToken, categoryId]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  // Filtered on the device rather than through the API: a category holds a
  // handful of subcategories, they are already all loaded, and matching
  // locally keeps the list responsive on every keystroke with no round trip.
  const visible = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return subcategories;
    return subcategories.filter((item) => item.name.toLowerCase().includes(term));
  }, [subcategories, query]);

  return (
    <View style={styles.container}>
      <ScreenHeader
        title="Subcategories"
        backLabel={categoryName || 'Category'}
        subtitle="Every product belongs to one of these. Price, description, and Hide/Unhide are set per subcategory."
        rightAction={
          <TouchableOpacity style={styles.addButton} onPress={() => navigation.navigate('SubcategoryForm', { categoryId })} activeOpacity={0.8}>
            <Text style={styles.addButtonText}>+ New</Text>
          </TouchableOpacity>
        }
      />

      {subcategories.length > 0 && (
        <Card style={styles.searchCard}>
          <Ionicons name="search" size={17} color={colors.textLabel} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search subcategories"
            placeholderTextColor={colors.textMuted}
            value={query}
            onChangeText={setQuery}
            autoCorrect={false}
            returnKeyType="search"
            onFocus={() => {
              if (blurTimer.current) clearTimeout(blurTimer.current);
              setSearchFocused(true);
            }}
            // Hidden a beat after blur rather than at once: on some Android
            // builds the blur lands before the tap on a recent search, and
            // hiding immediately would unmount the row being tapped.
            onBlur={() => {
              blurTimer.current = setTimeout(() => setSearchFocused(false), 150);
            }}
            onSubmitEditing={() => rememberSearch(query)}
          />
          {query.length > 0 && (
            <TouchableOpacity onPress={() => setQuery('')} hitSlop={10}>
              <Ionicons name="close-circle" size={17} color={colors.iconMuted} />
            </TouchableOpacity>
          )}
        </Card>
      )}

      {showRecents && (
        <Card style={styles.recentsCard}>
          <View style={styles.recentsHeader}>
            <Text style={styles.recentsTitle}>Recent searches</Text>
            <TouchableOpacity onPress={handleClearRecents} hitSlop={10}>
              <Text style={styles.recentsClear}>Clear</Text>
            </TouchableOpacity>
          </View>
          {recentSearches.map((term) => (
            <TouchableOpacity
              key={term}
              style={styles.recentRow}
              onPress={() => pickRecentSearch(term)}
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityLabel={`Search again for ${term}`}
            >
              <Ionicons name="time-outline" size={16} color={colors.iconMuted} />
              <Text style={styles.recentText} numberOfLines={1}>{term}</Text>
              <Ionicons name="arrow-up-outline" size={15} color={colors.iconMuted} style={styles.recentArrow} />
            </TouchableOpacity>
          ))}
        </Card>
      )}

      {loading ? (
        <ActivityIndicator style={{ marginTop: 40 }} color={colors.primary} />
      ) : error ? (
        <Text style={styles.error}>{error}</Text>
      ) : subcategories.length === 0 ? (
        <Text style={styles.empty}>No subcategories yet — tap "+ New" to add one.</Text>
      ) : visible.length === 0 ? (
        <Text style={styles.empty}>No subcategory matches "{query.trim()}".</Text>
      ) : (
        <FlatList
          data={visible}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ paddingBottom: 40 }}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          renderItem={({ item }) => (
            <Card style={styles.card}>
              <TouchableOpacity
                style={styles.row}
                onPress={() => {
                  rememberSearch(query);
                  navigation.navigate('SubcategoryForm', { categoryId, subcategoryId: item.id });
                }}
                activeOpacity={0.8}
              >
                {item.imageUrl ? (
                  <Image source={{ uri: item.imageUrl }} style={styles.thumb} />
                ) : (
                  <View style={[styles.thumb, styles.thumbPlaceholder]}>
                    <Ionicons name="image-outline" size={16} color={colors.iconMuted} />
                  </View>
                )}
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={styles.cardTitle} numberOfLines={1}>{item.name}</Text>
                  <View style={styles.metaLine}>
                    <Text style={styles.cardMeta} numberOfLines={1}>
                      {item._count?.products ?? 0} product{item._count?.products === 1 ? '' : 's'}{item.isActive ? '' : ' ·'}
                    </Text>
                    {!item.isActive && <Badge label="Hidden" tone="error" />}
                    {/* Falls back to the parent category's photo until one is
                        uploaded — surfaced so the gap is fixable, rather than
                        hidden behind a borrowed product photo. */}
                    {item.hasOwnImage === false && <Badge label="Needs photo" tone="warning" />}
                  </View>
                </View>
                <View style={styles.priceWrap}>
                  {/* The counter price — see ProductListScreen. */}
                  <Text style={styles.price}>₹{item.storePrice}</Text>
                  <Text style={styles.priceSub}>Store ₹{item.storePrice}</Text>
                </View>
                <Ionicons name="chevron-forward" size={16} color={colors.iconMuted} />
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.catalogLink}
                onPress={() => {
                  rememberSearch(query);
                  navigation.navigate('SubcategoryCatalog', { subcategoryId: item.id, subcategoryName: item.name });
                }}
              >
                <Ionicons name="document-text-outline" size={14} color={colors.primary} />
                <Text style={styles.catalogLinkText}>Catalog PDF</Text>
              </TouchableOpacity>
            </Card>
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
  recentsCard: { marginTop: -spacing.xs, marginBottom: spacing.md, paddingVertical: spacing.sm },
  recentsHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingBottom: spacing.xs,
  },
  recentsTitle: { ...typography.caption, color: colors.textLabel },
  recentsClear: { ...typography.bodySmSemibold, color: colors.primary },
  recentRow: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    paddingVertical: spacing.sm + 2, borderTopWidth: 1, borderTopColor: colors.divider,
  },
  recentText: { ...typography.body, color: colors.text, flex: 1 },
  recentArrow: { transform: [{ rotate: '-45deg' }] },
  searchCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm + 2,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md + 1,
    marginBottom: spacing.md,
  },
  searchInput: { flex: 1, ...typography.bodyMedium, color: colors.text, padding: 0 },
  card: {
    marginBottom: spacing.sm + 2,
    overflow: 'hidden',
    padding: 0,
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.md },
  catalogLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs + 2,
    borderTopWidth: 1,
    borderTopColor: colors.divider,
    paddingVertical: spacing.sm + 2,
    paddingHorizontal: spacing.md,
  },
  catalogLinkText: { ...typography.bodySmSemibold, color: colors.primary },
  thumb: { width: 44, height: 44, borderRadius: radius.md, backgroundColor: colors.placeholderBg },
  thumbPlaceholder: { alignItems: 'center', justifyContent: 'center' },
  cardTitle: { ...typography.bodySemibold, color: colors.text },
  metaLine: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs + 2, marginTop: 3 },
  cardMeta: { ...typography.bodySm, color: colors.textMuted, flexShrink: 1 },
  priceWrap: { alignItems: 'flex-end', flexShrink: 0 },
  price: { ...typography.price, color: colors.text },
  priceSub: { ...typography.bodySm, color: colors.textMuted, marginTop: 1 },
  empty: { fontSize: 13, color: colors.textMuted, marginTop: 24, textAlign: 'center' },
  error: {
    color: colors.error,
    backgroundColor: colors.errorBg,
    padding: spacing.sm + 2,
    borderRadius: radius.md,
    marginTop: spacing.md,
    fontSize: 13,
  },
});
