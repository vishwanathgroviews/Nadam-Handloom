// The batch being tagged: photos chosen from the gallery, each waiting for its tag, or
// a set's tags (section 5.1; sets since 15 Oct 2026). Kept on the phone as a draft, so it survives the app closing; it
// belongs to the person who started it. Photos are fitted to 3:4 in the background.
import { useSyncExternalStore } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { session } from '../auth/session';
import { newRef, tagsOf } from '../utils/products';
import { fitToCard, photoExists, removePhoto } from './photos';

const KEY = 'nandam.batch.v1';
let state = { batch: null, loaded: false };
const listeners = new Set();
const emit = () => listeners.forEach((l) => l());
const me = () => session.getState().user?.id || null;

function set(batch) {
  state = { ...state, batch };
  if (batch) AsyncStorage.setItem(KEY, JSON.stringify(batch)).catch(() => {});
  else AsyncStorage.removeItem(KEY).catch(() => {});
  emit();
}

let fitting = false;
async function fitAll() {
  if (fitting) return;
  fitting = true;
  try {
    for (;;) {
      const b = state.batch;
      const it = b?.items.find((x) => !x.uri && !x.lost);
      if (!it) break;
      try {
        const uri = await fitToCard(it.src, { width: it.w, height: it.h, shift: it.shift || 0, name: it.id });
        batchStore.updateItem(it.id, { uri });
      } catch {
        batchStore.updateItem(it.id, { lost: !photoExists(it.src) });
        if (photoExists(it.src)) break; // try again later
      }
    }
  } finally {
    fitting = false;
  }
}

// A draft saved before sets (one `tag` per photo, undo = photo numbers) in today's form:
// `tags` per photo, undo = [{ i, code }].
function upgrade(b) {
  const items = b.items.map(({ tag, ...x }) => ({ ...x, tags: tagsOf({ tag, ...x }), want: Math.max(1, x.want || 1) }));
  const undo = (b.undo || []).map((u) => (typeof u === 'number' ? { i: u, code: items[u]?.tags[0] } : u)).filter((u) => u.code && items[u.i]?.tags.includes(u.code));
  return { ...b, items, undo };
}

export const batchStore = {
  subscribe(l) { listeners.add(l); return () => listeners.delete(l); },
  getState: () => state,

  async load() {
    if (state.loaded) return;
    let batch = null;
    try { batch = JSON.parse((await AsyncStorage.getItem(KEY)) || 'null'); } catch { batch = null; }
    state = { batch: batch && upgrade(batch), loaded: true };
    emit();
    fitAll();
  },

  // assets: [{ uri, width, height }] from the gallery, in the order they were picked.
  start({ sub, channel, assets }) {
    const old = state.batch;
    if (old) old.items.forEach((x) => removePhoto(x.uri));
    set({
      id: newRef('b'), ownerId: me(), sub, channel, cur: 0, undo: [], createdAt: Date.now(),
      items: assets.map((a) => ({ id: newRef('p'), src: a.uri, w: a.width || 0, h: a.height || 0, uri: null, shift: 0, tags: [], want: 1, unchecked: false, skipped: false })),
    });
    fitAll();
  },
  update(fn) {
    if (!state.batch) return;
    set(fn(state.batch));
  },
  updateItem(id, change) {
    if (!state.batch) return;
    set({ ...state.batch, items: state.batch.items.map((x) => (x.id === id ? { ...x, ...change } : x)) });
  },
  // Re-fit one photo with the frame moved (Adjust photo).
  async refit(id, shift) {
    const it = state.batch?.items.find((x) => x.id === id);
    if (!it) return;
    removePhoto(it.uri);
    const uri = await fitToCard(it.src, { width: it.w, height: it.h, shift, name: `${it.id}-${Date.now().toString(36)}` });
    batchStore.updateItem(id, { uri, shift });
  },
  // After saving: keep only the photos still without a tag, as the draft.
  keepUntagged() {
    const b = state.batch;
    if (!b) return;
    const left = b.items.filter((x) => !tagsOf(x).length);
    set(left.length ? { ...b, items: left.map((x) => ({ ...x, skipped: false })), cur: 0, undo: [] } : null);
  },
  discard() {
    state.batch?.items.forEach((x) => removePhoto(x.uri));
    set(null);
  },
};

// The draft of the signed-in person, or null.
export function useBatch() {
  const s = useSyncExternalStore(batchStore.subscribe, batchStore.getState);
  return s.batch && s.batch.ownerId === me() ? s.batch : null;
}
export const ensureFitted = fitAll;
