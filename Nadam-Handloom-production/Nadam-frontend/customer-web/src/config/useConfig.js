import { useSyncExternalStore } from 'react';
import { configStore } from './config.js';

export const useConfig = () => useSyncExternalStore(configStore.subscribe, configStore.get, configStore.get);
