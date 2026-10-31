// What the website reads first from the server (/shop/config): the website switch, the shop's
// contact details, the lists for its forms and the public Firebase values.
import { shopApi } from '../api/shop.js';
import { on } from '../api/client.js';
import { STATES_FALLBACK } from '../utils/places.js';

const FALLBACK = {
  maintenance: { on: false, message: '' },
  shop: { name: 'Nandam Handlooms', mobile: '7382388565', address: 'Hussain Katta, Mangalagiri, Andhra Pradesh, 522503, India', gstin: '37CCWPN2487C1Z2', website: null },
  store: {
    addressLines: ['#10-23, Opp. Brahmam Gari Temple', 'Hussain Katta, Old Mangalagiri', 'Guntur Dist, Andhra Pradesh 522 503'],
    hours: 'Monday to Sunday, 9:30 am to 8:30 pm',
    whatsapp: '917382388565',
    mapUrl: 'https://maps.app.goo.gl/qK54PztChaCdGzMz6',
  },
  signIn: { codeLength: 6, resendSeconds: 60, sessionDays: 30 },
  limits: { maxAddresses: 10, avatarMaxBytes: 5 * 1024 * 1024, nameMax: 60, deleteAfterDays: 7 },
  states: STATES_FALLBACK,
  languages: [{ code: 'en', name: 'English' }, { code: 'te', name: 'Telugu' }, { code: 'hi', name: 'Hindi' }],
  addressLabels: ['home', 'office', 'other'],
  push: null,
};

let state = { status: 'loading', config: FALLBACK, error: null };
const subscribers = new Set();
function set(patch) {
  state = { ...state, ...patch };
  subscribers.forEach((fn) => fn());
}
export const configStore = {
  subscribe(fn) { subscribers.add(fn); return () => subscribers.delete(fn); },
  get: () => state,
};

export async function loadConfig() {
  try {
    const config = await shopApi.config();
    set({ status: 'ready', config: { ...FALLBACK, ...config }, error: null });
  } catch (err) {
    // The pages still work with the built-in lists; push and the website switch wait.
    set({ status: 'error', error: err, ...(err.code === 'MAINTENANCE' ? { config: { ...state.config, maintenance: { on: true, message: err.details?.message || '' } } } : {}) });
  }
}

// A reply said the website is switched off while it was open.
on('maintenance', (m) => set({ config: { ...state.config, maintenance: { on: true, message: m.message || '' } } }));
