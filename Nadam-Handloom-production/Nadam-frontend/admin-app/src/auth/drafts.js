// Unfinished work kept on the phone (docs section 4.4): a half-built bill or form
// survives a re-sign-in for the same person, and is cleared if a different person signs in.
// Later modules save into it; Module 1 provides the mechanism and the "restored" message.
import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = 'nandam.drafts.v1';

async function read() {
  try {
    return JSON.parse((await AsyncStorage.getItem(KEY)) || 'null') || { ownerId: null, items: {} };
  } catch {
    return { ownerId: null, items: {} };
  }
}

export async function onSignedIn(accountId) {
  const d = await read();
  if (d.ownerId && d.ownerId !== accountId) await AsyncStorage.removeItem(KEY);
}

export async function saveDraft(accountId, name, data) {
  const d = await read();
  const items = d.ownerId === accountId ? d.items : {};
  items[name] = { data, savedAt: new Date().toISOString() };
  await AsyncStorage.setItem(KEY, JSON.stringify({ ownerId: accountId, items }));
}

export async function getDrafts(accountId) {
  const d = await read();
  if (!accountId || d.ownerId !== accountId) return [];
  return Object.entries(d.items).map(([name, v]) => ({ name, ...v }));
}

export async function removeDraft(accountId, name) {
  const d = await read();
  if (d.ownerId !== accountId) return;
  delete d.items[name];
  await AsyncStorage.setItem(KEY, JSON.stringify(d));
}
