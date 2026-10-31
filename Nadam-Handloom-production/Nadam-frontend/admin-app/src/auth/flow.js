// Short-lived state shared by the screens of one journey (setup, Forgot PIN,
// new-phone check): the mobile number, the step token, code timing. Memory only.
import { useSyncExternalStore } from 'react';

let flow = {};
const listeners = new Set();

export const flowStore = {
  get: () => flow,
  set(patch) {
    flow = { ...flow, ...patch };
    listeners.forEach((l) => l());
  },
  reset(next = {}) {
    flow = next;
    listeners.forEach((l) => l());
  },
  subscribe(l) {
    listeners.add(l);
    return () => listeners.delete(l);
  },
};

export const useFlow = () => useSyncExternalStore(flowStore.subscribe, flowStore.get);
