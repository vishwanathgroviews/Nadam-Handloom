import AsyncStorage from '@react-native-async-storage/async-storage';

const CACHE_PREFIX = 'nandam_offline_cache_';

interface CacheEnvelope<T> {
  savedAt: string;
  data: T;
}

/** Read-only catalog cache — browse-while-offline only, never used for anything transactional. */
export const saveToCache = async <T>(key: string, data: T): Promise<void> => {
  try {
    const envelope: CacheEnvelope<T> = { savedAt: new Date().toISOString(), data };
    await AsyncStorage.setItem(CACHE_PREFIX + key, JSON.stringify(envelope));
  } catch (err) {
    console.warn(`Failed to write offline cache "${key}":`, err);
  }
};

export const loadFromCache = async <T>(key: string): Promise<{ data: T; savedAt: string } | null> => {
  try {
    const raw = await AsyncStorage.getItem(CACHE_PREFIX + key);
    if (!raw) return null;
    const envelope = JSON.parse(raw) as CacheEnvelope<T>;
    return { data: envelope.data, savedAt: envelope.savedAt };
  } catch (err) {
    console.warn(`Failed to read offline cache "${key}":`, err);
    return null;
  }
};
