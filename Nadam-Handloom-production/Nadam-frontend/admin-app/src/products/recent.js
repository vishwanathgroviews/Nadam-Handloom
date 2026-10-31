// Subcategories used most recently for adding sarees: shown first when choosing one.
import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = 'nandam.products.recentSubs';
export async function recentSubs() {
  try { return JSON.parse((await AsyncStorage.getItem(KEY)) || '[]'); } catch { return []; }
}
export async function markSubUsed(id) {
  const list = (await recentSubs()).filter((x) => x !== id);
  await AsyncStorage.setItem(KEY, JSON.stringify([id, ...list].slice(0, 5))).catch(() => {});
}
