// The bill being built at the counter (5.1): kept on the phone, so closing the app or
// a phone call loses nothing. One per person, as the bill belongs to whoever started it.
//
// Its id goes to the server with "Complete sale", so sending it again (slow network,
// double tap) returns the same sale. If a send got no answer, the bill is "pending":
// it can't be changed until it is sent again, so a sale that did go through is never
// followed by a different bill under the same id.
import { useSyncExternalStore } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { session } from '../auth/session';
import { newRef } from '../utils/products';

const KEY = (userId) => `nandam.bill.v1.${userId}`;
const EMPTY_FORM = { where: null, pay: null, invoice: null, name: '', mobile: '', address: '' };
const fresh = () => ({ id: newRef('bill'), lines: [], form: { ...EMPTY_FORM }, pending: false, changed: null, restored: false, createdAt: Date.now() });

let state = { userId: null, bill: fresh(), lastSale: null };
const listeners = new Set();
const emit = () => listeners.forEach((l) => l());
const me = () => session.getState().user?.id || null;

function set(bill) {
  state = { ...state, bill };
  if (state.userId) {
    if (bill.lines.length || bill.pending) AsyncStorage.setItem(KEY(state.userId), JSON.stringify({ ...bill, restored: false })).catch(() => {});
    else AsyncStorage.removeItem(KEY(state.userId)).catch(() => {});
  }
  emit();
}
const change = (fn) => set({ ...fn(state.bill), restored: false });

export const billStore = {
  subscribe(l) { listeners.add(l); return () => listeners.delete(l); },
  getState: () => state,

  // The signed-in person's bill, as it was when the app closed.
  async load() {
    const userId = me();
    if (!userId || state.userId === userId) return;
    let saved = null;
    try { saved = JSON.parse((await AsyncStorage.getItem(KEY(userId))) || 'null'); } catch { saved = null; }
    state = { userId, bill: saved?.id ? { ...fresh(), ...saved, form: { ...EMPTY_FORM, ...saved.form }, restored: saved.lines?.length > 0 } : fresh(), lastSale: null };
    emit();
  },

  add(saree, { held = false } = {}) {
    change((b) => ({
      ...b,
      changed: null,
      lines: [...b.lines, { pieceId: saree.pieceId, productId: saree.productId, code: saree.code, name: saree.name, imageUrl: saree.imageUrl, storePrice: saree.storePrice, agreed: null, held }],
    }));
  },
  remove(pieceId) {
    change((b) => ({ ...b, lines: b.lines.filter((l) => l.pieceId !== pieceId), changed: b.changed?.pieceId === pieceId ? null : b.changed }));
  },
  setAgreed(pieceId, agreed) {
    change((b) => ({ ...b, lines: b.lines.map((l) => (l.pieceId === pieceId ? { ...l, agreed } : l)) }));
  },
  // "Yes, sell at ₹1,200": a price under half the store price, confirmed (6.3).
  confirmLow(pieceId) {
    change((b) => ({ ...b, lines: b.lines.map((l) => (l.pieceId === pieceId ? { ...l, lowOk: l.agreed } : l)) }));
  },
  // The owner chose "Sell anyway" for this saree after it became held.
  setHeld(pieceId) {
    change((b) => ({ ...b, lines: b.lines.map((l) => (l.pieceId === pieceId ? { ...l, held: true } : l)), changed: null }));
  },
  // The store price changed in the catalogue while the bill was open.
  setStorePrice(pieceId, storePrice) {
    change((b) => ({ ...b, lines: b.lines.map((l) => (l.pieceId === pieceId ? { ...l, storePrice } : l)) }));
  },
  setForm(patch) { change((b) => ({ ...b, form: { ...b.form, ...patch } })); },
  // The server named a saree that can't be sold any more (LINE_CHANGED).
  markChanged(changed) { change((b) => ({ ...b, changed, pending: false })); },
  setPending(pending) { change((b) => ({ ...b, pending })); },
  dismissRestored() { set({ ...state.bill, restored: false }); },
  clear() { set(fresh()); },
  // Sold: the next customer starts a new bill with a new id.
  sold(result) {
    state = { ...state, lastSale: result };
    set(fresh());
  },
};

export function useBill() {
  const s = useSyncExternalStore(billStore.subscribe, billStore.getState);
  return s.bill;
}
export const useLastSale = () => useSyncExternalStore(billStore.subscribe, billStore.getState).lastSale;
