// Every sign-in rule in one place. These numbers are the decisions recorded in
// docs/modules/module-01-sign-in.md (section 5). Change them there first.
export const AUTH = Object.freeze({
  PIN_LENGTH: 6,
  LEGACY_PIN_LENGTH: 4, // old 4-digit PINs sign in once, then must be upgraded
  MAX_PIN_TRIES: 5, // wrong PINs before a lock, counted per mobile number
  LOCK_MINUTES: [15, 30, 60], // 1st lock, 2nd lock, 3rd and later
  CODE_TTL_SECONDS: 60, // Message Central codes live 60 seconds
  CODE_MAX_TRIES: 3,
  CODE_RESEND_SECONDS: 60,
  CODE_MAX_PER_HOUR: 5,
  STEP_TOKEN_MINUTES: 10, // finish setup / reset / new-phone / upgrade within this time
  CHANGE_TOKEN_MINUTES: 5, // finish Change PIN within this time after the current PIN is checked
  ACCESS_TOKEN_MINUTES: 15, // renewed silently by the app
  SESSION_DAYS: 7, // sign-in length, renewed on every use
  BIOMETRIC_CHALLENGE_SECONDS: 60,
  REFRESH_RACE_GRACE_SECONDS: 10, // a just-rotated token sent again from the same device is a race, not theft
  APP_ROLES: ['ADMIN', 'STAFF'], // ADMIN is shown as "Owner"
});

// Why a session ended. Stored in Session.revokeReason and mapped to what the app shows.
export const REVOKE = Object.freeze({
  ROTATED: 'rotated',
  LOGOUT: 'logout',
  DEVICE_SIGNED_OUT: 'device_signed_out',
  OTHERS_SIGNED_OUT: 'others_signed_out',
  PIN_RESET: 'pin_reset',
  PIN_LOCKED: 'pin_locked',
  REUSE_DETECTED: 'reuse_detected',
  ACCESS_REMOVED: 'access_removed',
  SUPERSEDED: 'superseded', // a renewal whose reply was lost, replaced by a new one
});

// One-time-code purposes. Kept apart from the old app's ('signup_verify', 'mpin_reset').
export const CODE_PURPOSE = Object.freeze({
  SETUP: 'app_setup',
  RESET: 'app_reset',
  DEVICE: 'app_device',
});

// Step tokens: short-lived proof that an earlier step (SMS code, PIN check) passed.
export const STEP = Object.freeze({
  SET_PIN_SETUP: 'set_pin_setup',
  SET_PIN_RESET: 'set_pin_reset',
  UPGRADE_PIN: 'upgrade_pin',
  DEVICE_CHECK: 'device_check',
  CHANGE_PIN: 'change_pin',
});

// ---------------------------------------------------------------------------
// Website (W1: customer sign-in and account). The numbers are the decisions in
// docs/modules/web-01-sign-in.md (section 5). Change them there first.
// ---------------------------------------------------------------------------
export const SHOP = Object.freeze({
  CODE_LENGTH: 6,
  CODE_TTL_SECONDS: 600, // 10 minutes (Message Central keeps its own, shorter limit)
  CODE_MAX_TRIES: 3,
  CODE_RESEND_SECONDS: 60,
  CODE_MAX_PER_HOUR: 5, // per mobile number
  CODE_MAX_PER_NETWORK_HOUR: 20, // per IPv6 /64 block (one home or phone): utils/network.js
  CODE_MAX_PER_IPV4_HOUR: 60, // per IPv4 address: mobile carriers share one among many customers
  PROFILE_STEP_MINUTES: 15, // finish "Complete your profile" within this time after the code
  PROFILE_REPEAT_SECONDS: 60, // a second "Create account" (double tap, lost reply) within this time signs in; later it is refused
  ACCESS_TOKEN_MINUTES: 15,
  SESSION_DAYS: 30, // extended on every use
  REFRESH_GRACE_SECONDS: 10, // a renewal repeated this soon (lost reply, two tabs) is not theft
  MAX_SESSIONS: 20, // signed-in browsers per customer; the oldest ends after this
  MAX_ADDRESSES: 10,
  DELETE_AFTER_DAYS: 7, // "Delete my account": time to change one's mind
  AVATAR_MAX_BYTES: 5 * 1024 * 1024,
  AVATAR_EDGE: 256,
  AVATAR_MAX_PIXELS: { jpeg: 100_000_000, png: 25_000_000, webp: 25_000_000 }, // JPEG shrinks while it loads; PNG and WebP open in full
  NAME_MIN: 2,
  NAME_MAX: 60,
  LAST_SEEN_EVERY_SECONDS: 300, // how often "last seen" is written for an active customer
});

// Why a website sign-in ended. Stored in Session.revokeReason.
export const SHOP_REVOKE = Object.freeze({
  ROTATED: 'rotated', // renewed: replaced by a newer key (same value as the admin side)
  LOGOUT: 'logout',
  SIGNED_OUT_ELSEWHERE: 'device_signed_out', // ended from "Signed-in devices" on another browser
  SIGNED_OUT_ALL: 'signed_out_all',
  REUSE_DETECTED: 'reuse_detected',
  // A renewal repeated within the grace (its reply was lost): the unused successor is
  // replaced. Presenting it later only ends that browser's sign-in, never all of them.
  SUPERSEDED: 'superseded',
  TOO_MANY: 'too_many_sessions',
  ACCOUNT_DELETED: 'account_deleted',
});

export const SHOP_CODE_PURPOSE = Object.freeze({
  SIGN_IN: 'shop_sign_in',
  CHANGE_MOBILE: 'shop_change_mobile',
});

export const SHOP_STEP = Object.freeze({ PROFILE: 'shop_profile' });

// Push topics a browser can follow. Orders are about the customer's own orders;
// arrivals and offers are marketing (need the customer's consent).
export const PUSH_TOPICS = Object.freeze(['orders', 'arrivals', 'offers']);
export const MARKETING_TOPICS = Object.freeze(['arrivals', 'offers']);

export const LANGUAGES = Object.freeze({ en: 'English', te: 'Telugu', hi: 'Hindi' });
export const ADDRESS_LABELS = Object.freeze(['home', 'office', 'other']);

// States and union territories, as India Post names them (the Pincode table uses the same names).
export const INDIAN_STATES = Object.freeze([
  'Andaman and Nicobar Islands', 'Andhra Pradesh', 'Arunachal Pradesh', 'Assam', 'Bihar', 'Chandigarh',
  'Chhattisgarh', 'Dadra and Nagar Haveli and Daman and Diu', 'Delhi', 'Goa', 'Gujarat', 'Haryana',
  'Himachal Pradesh', 'Jammu and Kashmir', 'Jharkhand', 'Karnataka', 'Kerala', 'Ladakh', 'Lakshadweep',
  'Madhya Pradesh', 'Maharashtra', 'Manipur', 'Meghalaya', 'Mizoram', 'Nagaland', 'Odisha', 'Puducherry',
  'Punjab', 'Rajasthan', 'Sikkim', 'Tamil Nadu', 'Telangana', 'Tripura', 'Uttar Pradesh', 'Uttarakhand',
  'West Bengal',
]);

// ---------------------------------------------------------------------------
// Website shop (W2 home, W3 lists, W4 saree page). Decisions in
// docs/modules/web-02-home-and-shop.md. Change them there first.
// ---------------------------------------------------------------------------
// Website W6: checkout and payment (docs/modules/web-04-checkout.md section 7).
export const PAYMENTS = Object.freeze({
  HOLD_MINUTES: 15, // sarees held from Pay (decision 6.10)
  MAX_HOLD_MINUTES: 30, // Pay again renews the hold, at most this long after checkout began
  CAPTURE_MINUTES: 15, // Razorpay takes a payment authorised within this; later ones it returns itself
  CONFIRM_DAYS: 3, // a payment the bank is slow on is checked for this long
  SWEEP_SECONDS: 30, // ending holds whose time is up
  CHECK_SECONDS: 60, // checking slow payments and making missing invoices
  MAX_LINES: 20, // sarees in one order (the bag's limit)
});

// Website W5: the bag (docs/modules/web-03-cart.md section 5.12).
export const BAG = Object.freeze({
  MAX_LINES: 20, // different sarees in one bag (the most in one old online order was 3)
  MAX_QUANTITY: 50, // pieces of one saree asked for; always capped by what is in stock
  KEEP_DAYS: 60, // a signed-in bag's saree unchanged this long is removed by the clean-up job
});

export const SHOP_CATALOG = Object.freeze({
  // A website price below this is a typing mistake (₹2, ₹8, ₹9 on live, Oct 2026): the saree
  // stays off the website until the price is fixed, and the admin app says why.
  MIN_ONLINE_PRICE: 500,
  PAGE_SIZE: 24,
  MAX_PAGE_SIZE: 48,
  NEW_DAYS: 10, // "New" badge on sarees added in the last 10 days
  CACHE_SECONDS: 60, // home and catalogue summary are re-read at most once a minute
  NEWEST: 12,
  SETS: 10,
  SPOTLIGHT: 3,
  MORE_FROM_COLLECTION: 12,
  SIMILAR: 10,
  SEARCH_MAX: 80,
});

// Price bands for the list filter (rupees, inclusive).
export const PRICE_BANDS = Object.freeze([
  { key: 'u25', label: 'Under ₹2,500', min: 0, max: 2499 },
  { key: '25-35', label: '₹2,500 to ₹3,500', min: 2500, max: 3500 },
  { key: '35-50', label: '₹3,501 to ₹5,000', min: 3501, max: 5000 },
  { key: 'o50', label: 'Over ₹5,000', min: 5001, max: 1e9 },
]);

// "Shop by craft": groups made from words in the collection names (the same rules the
// approved mock-up used; the first match wins). Shown to the owner to confirm.
export const CRAFTS = Object.freeze([
  { key: 'embroidery', name: 'Embroidery', match: /embroid|chikankari/i },
  { key: 'applique', name: 'Applique', match: /applique/i },
  { key: 'digital', name: 'Digital Print', match: /digital/i },
  { key: 'screen', name: 'Screen & Block Print', match: /screen|baguru|bagru|embossing/i },
  { key: 'kalamkari', name: 'Kalamkari & Hand Painted', match: /kalamkari|kalankari|hand ?painted|tanjore/i },
  { key: 'bandhani', name: 'Bandhani & Shibori', match: /bandini|bandhani|shibori/i },
  { key: 'checks', name: 'Checks', match: /\bchecks?\b/i },
  { key: 'pure', name: 'Pure Pattu & Plain', match: /pure pattu|plain|\bbutt?a\b/i },
]);

// Home page "edits": groups of crafts (and the sets).
export const EDITS = Object.freeze([
  { key: 'wedding', crafts: ['pure'] },
  { key: 'festive', crafts: ['kalamkari'] },
  { key: 'pastels', crafts: ['embroidery', 'applique'] },
  { key: 'everyday', crafts: ['checks', 'digital', 'screen', 'bandhani'] },
  { key: 'family', sets: true },
]);

// The store (from the old website, Oct 2026). Phone and address on invoices come from Settings.
export const STORE = Object.freeze({
  addressLines: ['#10-23, Opp. Brahmam Gari Temple', 'Hussain Katta, Old Mangalagiri', 'Guntur Dist, Andhra Pradesh 522 503'],
  hours: 'Monday to Sunday, 9:30 am to 8:30 pm',
  openingHours: 'Mo-Su 09:30-20:30',
  whatsapp: '917382388565', // changed from 917382968566 on 23 Oct 2026 (shop's request)
  mapUrl: 'https://maps.app.goo.gl/qK54PztChaCdGzMz6',
});
