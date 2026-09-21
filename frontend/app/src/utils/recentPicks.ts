import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * The things someone picked out of a search box recently — for the
 * subcategory search on the product form, the subcategories they actually
 * opened, rather than the words they typed to find them. A shop adds several
 * products to the same subcategory in a row, so the last few are almost
 * always the next one.
 */
export interface RecentPick {
  id: string;
  name: string;
}

export const MAX_RECENT_PICKS = 5;

/**
 * Puts `pick` at the front of the list.
 *
 * Kept free of storage so the rules are testable on their own: picking
 * something again moves it to the front instead of appearing twice, its name
 * is refreshed in case it was renamed since, and the list never grows past
 * `max`.
 */
export const addRecentPick = (list: RecentPick[], pick: RecentPick, max = MAX_RECENT_PICKS): RecentPick[] => {
  if (!pick.id) return list.slice(0, max);
  return [pick, ...list.filter((item) => item.id !== pick.id)].slice(0, max);
};

/**
 * Storage key for one person's picks in one category.
 *
 * Per category because a subcategory only exists inside its category. Per
 * user because staff share counter phones — one person's recents shouldn't
 * be offered to the next person who signs in.
 */
export const recentPicksKey = (userId: string | null | undefined, scope: string) =>
  `nandam_recent_picks_${userId ?? 'anon'}_${scope}`;

const isPick = (item: unknown): item is RecentPick =>
  typeof item === 'object' && item !== null &&
  typeof (item as RecentPick).id === 'string' && typeof (item as RecentPick).name === 'string';

export const loadRecentPicks = async (key: string): Promise<RecentPick[]> => {
  try {
    const raw = await AsyncStorage.getItem(key);
    const parsed = raw ? JSON.parse(raw) : [];
    // Tolerate anything odd a previous build (or a corrupt write) left behind.
    return Array.isArray(parsed) ? parsed.filter(isPick).slice(0, MAX_RECENT_PICKS) : [];
  } catch {
    return [];
  }
};

export const saveRecentPicks = async (key: string, list: RecentPick[]): Promise<void> => {
  try {
    await AsyncStorage.setItem(key, JSON.stringify(list.slice(0, MAX_RECENT_PICKS)));
  } catch {
    // Recents are a convenience; failing to store them must never get in the
    // way of choosing a subcategory.
  }
};

export const clearRecentPicks = async (key: string): Promise<void> => {
  try {
    await AsyncStorage.removeItem(key);
  } catch {
    // See saveRecentPicks.
  }
};
