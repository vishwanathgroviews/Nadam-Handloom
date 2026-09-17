import AsyncStorage from '@react-native-async-storage/async-storage';

export const MAX_RECENT_SEARCHES = 5;

/**
 * Puts `term` at the front of a recent-searches list.
 *
 * Kept free of storage so the rules are testable on their own: blank terms
 * are ignored, a repeat moves to the front instead of appearing twice
 * ("Pattu" and "pattu " are the same search), and the list never grows past
 * `max`.
 */
export const addRecentSearch = (list: string[], term: string, max = MAX_RECENT_SEARCHES): string[] => {
  const cleaned = term.trim().replace(/\s+/g, ' ');
  if (!cleaned) return list.slice(0, max);
  const key = cleaned.toLowerCase();
  return [cleaned, ...list.filter((item) => item.toLowerCase() !== key)].slice(0, max);
};

/**
 * Storage key for one person's searches in one category.
 *
 * Per category because a search is only meaningful against that category's
 * subcategories. Per user because staff share counter phones — one person's
 * searches shouldn't be offered to the next person who signs in.
 */
export const recentSearchesKey = (userId: string | null | undefined, scope: string) =>
  `nandam_recent_searches_${userId ?? 'anon'}_${scope}`;

export const loadRecentSearches = async (key: string): Promise<string[]> => {
  try {
    const raw = await AsyncStorage.getItem(key);
    const parsed = raw ? JSON.parse(raw) : [];
    // Tolerate anything odd a previous build (or a corrupt write) left behind.
    return Array.isArray(parsed)
      ? parsed.filter((item): item is string => typeof item === 'string').slice(0, MAX_RECENT_SEARCHES)
      : [];
  } catch {
    return [];
  }
};

export const saveRecentSearches = async (key: string, list: string[]): Promise<void> => {
  try {
    await AsyncStorage.setItem(key, JSON.stringify(list.slice(0, MAX_RECENT_SEARCHES)));
  } catch {
    // Recent searches are a convenience; failing to store them must never
    // get in the way of searching.
  }
};

export const clearRecentSearches = async (key: string): Promise<void> => {
  try {
    await AsyncStorage.removeItem(key);
  } catch {
    // See saveRecentSearches.
  }
};
