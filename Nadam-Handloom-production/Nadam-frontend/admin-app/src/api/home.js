// The Home endpoints (Module 8).
import { api } from './client';

// { date, day, updatedAt, scope, sales, attention, recent, stock }
export const getHome = () => api('/home');
// { days, soldOut: [...], low: [...] } (owners)
export const runningLow = () => api('/home/stock');
