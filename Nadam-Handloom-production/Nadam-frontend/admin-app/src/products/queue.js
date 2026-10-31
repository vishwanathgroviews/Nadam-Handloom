// The upload queue: sarees waiting to be saved on the server, one at a time, in the
// background (Module 4, sections 5.1 and 6.13). Kept on the phone, so closing the app
// or losing the internet loses nothing; it carries on when the app is open and online.
// Each listing (one photo: one saree, or a set's tags) has its own clientRef, so a
// repeated upload never makes a second copy.
// Uploads belong to the person who added them: they wait if someone else signs in.
import { useSyncExternalStore } from 'react';
import { AppState } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';
import * as productsApi from '../api/products';
import { session, SESSION_END_CODES } from '../auth/session';
import { NEEDS_FIX, newRef, retryDelay, tagsOf } from '../utils/products';
import { removePhoto } from './photos';

const KEY = 'nandam.uploads.v1';
let state = { jobs: [], loaded: false };
const listeners = new Set();
const emit = () => listeners.forEach((l) => l());
const me = () => session.getState().user?.id || null;

function set(jobs) {
  state = { ...state, jobs };
  AsyncStorage.setItem(KEY, JSON.stringify(jobs)).catch(() => {});
  emit();
}
const patch = (clientRef, change) => set(state.jobs.map((j) => (j.clientRef === clientRef ? { ...j, ...change } : j)));

let running = false;
let timer = null;
let started = false;

async function pump() {
  if (running || !started || session.getState().status !== 'signedIn') return;
  running = true;
  try {
    for (;;) {
      const now = Date.now();
      const job = state.jobs.find((j) => j.ownerId === me() && (j.status === 'waiting' || j.status === 'sending') && (j.nextTryAt || 0) <= now);
      if (!job) break;
      patch(job.clientRef, { status: 'sending' });
      try {
        const r = await productsApi.createProduct({ photoUri: job.photoUri, subcategoryId: job.subcategoryId, tags: tagsOf(job), channel: job.channel, clientRef: job.clientRef, batchId: job.batchId });
        const p = r.product;
        patch(job.clientRef, { status: 'saved', productId: p.id, sku: p.sku, imageUrl: p.images[0]?.url || null, savedAt: Date.now(), error: null });
        removePhoto(job.photoUri);
      } catch (err) {
        if (SESSION_END_CODES.has(err.code)) { patch(job.clientRef, { status: 'waiting' }); break; }
        if (NEEDS_FIX.has(err.code)) {
          patch(job.clientRef, { status: 'failed', error: { code: err.code, message: err.message, product: err.details?.product || null, tag: await badTag(job, err) } });
        } else {
          const attempts = (job.attempts || 0) + 1;
          patch(job.clientRef, { status: 'waiting', attempts, nextTryAt: Date.now() + retryDelay(attempts), error: { code: err.code, message: err.message } });
          break; // offline or the server is busy: wait, then try again
        }
      }
    }
  } finally {
    running = false;
    schedule();
  }
}

// Which of a listing's tags the server refused, so Fix replaces that one.
async function badTag(job, err) {
  const tags = tagsOf(job);
  if (err.details?.code && tags.includes(err.details.code)) return err.details.code;
  if (tags.length === 1) return tags[0];
  try {
    const r = await productsApi.checkTags(tags);
    return r.find((t) => t.status !== 'free')?.code || null;
  } catch { return null; }
}

function schedule() {
  clearTimeout(timer);
  const next = state.jobs.filter((j) => j.ownerId === me() && j.status === 'waiting').map((j) => j.nextTryAt || 0).sort((a, b) => a - b)[0];
  if (next === undefined) return;
  timer = setTimeout(pump, Math.max(500, next - Date.now()));
}

export const queue = {
  subscribe(l) { listeners.add(l); return () => listeners.delete(l); },
  getState: () => state,

  async load() {
    if (state.loaded) return;
    let jobs = [];
    try { jobs = JSON.parse((await AsyncStorage.getItem(KEY)) || '[]'); } catch { jobs = []; }
    // Anything that was mid-send when the app closed is simply sent again (same clientRef).
    state = { jobs: jobs.map((j) => (j.status === 'sending' ? { ...j, status: 'waiting' } : j)), loaded: true };
    emit();
  },

  // Starts the background worker (signed-in app). Runs when online and when the app comes back.
  async start() {
    await queue.load();
    if (started) return;
    started = true;
    NetInfo.addEventListener((s) => {
      if (s.isConnected !== false && s.isInternetReachable !== false) queue.retryNow();
    });
    AppState.addEventListener('change', (s) => { if (s === 'active') queue.retryNow(); });
    pump();
  },

  // items: [{ photoUri, tags }]; shared: { batchId, subcategoryId, subcategoryName, channel }
  add(items, shared) {
    const ownerId = me();
    const now = Date.now();
    const jobs = items.map((it, i) => ({ clientRef: newRef('sr'), ownerId, ...shared, photoUri: it.photoUri, tags: tagsOf(it), status: 'waiting', attempts: 0, addedAt: now + i, nextTryAt: 0, error: null }));
    set([...state.jobs, ...jobs]);
    pump();
    return jobs.map((j) => j.clientRef);
  },

  // A listing that needs a different tag: try again with it in place of the refused one.
  fixTag(clientRef, code) {
    const j = state.jobs.find((x) => x.clientRef === clientRef);
    if (!j) return;
    const old = tagsOf(j);
    const bad = j.error?.tag && old.includes(j.error.tag) ? j.error.tag : old[old.length - 1];
    const next = { ...j, tags: old.map((t) => (t === bad ? code : t)), status: 'waiting', error: null, nextTryAt: 0, attempts: 0 };
    delete next.tag; // jobs saved before sets
    set(state.jobs.map((x) => (x.clientRef === clientRef ? next : x)));
    pump();
  },
  discard(clientRef) {
    const j = state.jobs.find((x) => x.clientRef === clientRef);
    if (j) removePhoto(j.photoUri);
    set(state.jobs.filter((x) => x.clientRef !== clientRef));
  },
  // Forget finished sarees of a batch once the person has seen the result.
  clearSaved(batchId) {
    set(state.jobs.filter((j) => !(j.batchId === batchId && j.status === 'saved')));
  },
  retryNow() {
    set(state.jobs.map((j) => (j.status === 'waiting' ? { ...j, nextTryAt: 0 } : j)));
    pump();
  },
};

// Tags already waiting to be saved (so the same tag isn't used twice before the server knows it).
export const pendingTags = () => new Set(state.jobs.filter((j) => j.status !== 'saved').flatMap(tagsOf));

export function useUploads() {
  const s = useSyncExternalStore(queue.subscribe, queue.getState);
  const mine = s.jobs.filter((j) => j.ownerId === me());
  const open = mine.filter((j) => j.status !== 'saved');
  return {
    jobs: mine,
    open,
    waiting: open.filter((j) => j.status === 'waiting' || j.status === 'sending').length,
    failed: open.filter((j) => j.status === 'failed').length,
    others: s.jobs.filter((j) => j.ownerId !== me() && j.status !== 'saved').length,
  };
}
