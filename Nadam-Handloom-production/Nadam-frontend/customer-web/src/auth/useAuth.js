import { useSyncExternalStore } from 'react';
import { authStore } from './session.js';

// The sign-in state, re-rendering when it changes.
export const useAuth = () => useSyncExternalStore(authStore.subscribe, authStore.get, authStore.get);
