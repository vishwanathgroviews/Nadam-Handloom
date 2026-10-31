// Reads and checks every setting the server needs, once, at start-up.
// A missing or invalid setting stops the server with a clear message.
import 'dotenv/config';
import { z } from 'zod';

const schema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    PORT: z.coerce.number().int().positive().default(4100),
    // Where to listen: empty = every address; 127.0.0.1 = only inside the server (behind nginx).
    HOST: z.string().optional(),
    DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
    JWT_ACCESS_SECRET: z.string().min(32, 'JWT_ACCESS_SECRET must be at least 32 characters'),
    JWT_STEP_SECRET: z.string().min(32, 'JWT_STEP_SECRET must be at least 32 characters'),
    // Website (W1): the customer sign-in key's own secret, so an admin-app key can never
    // be used on the website or the other way round.
    JWT_SHOP_ACCESS_SECRET: z.string().min(32, 'JWT_SHOP_ACCESS_SECRET must be at least 32 characters'),
    // The website's own addresses (comma separated, e.g. https://new.nandamhandlooms.com).
    // Only these may call /api/v2/shop from a browser and use the 30-day sign-in cookie.
    SHOP_WEB_ORIGINS: z.string().optional(),
    // The sign-in cookie is sent only over https. Default: on in production, off for
    // http://localhost during development.
    SHOP_COOKIE_SECURE: z.enum(['true', 'false']).optional(),
    // Safety net against SMS abuse: website codes stop for the day after this many.
    SHOP_SMS_DAILY_LIMIT: z.coerce.number().int().positive().default(500),
    // The website's built index.html (live: /var/www/nandam-web/dist/index.html): saree pages
    // are served from it with the saree's own link preview. Not set: nginx serves the plain page.
    SHOP_WEB_INDEX: z.string().optional(),
    // Admin app: turning on Face ID / fingerprint needs the PIN. Off until the app version
    // that asks for the PIN is on every phone (older versions can't send it); when off, a PIN
    // that is sent is still checked.
    BIOMETRIC_NEEDS_PIN: z.enum(['true', 'false']).default('false'),
    SMS_PROVIDER: z.enum(['console', 'messagecentral', 'msg91']).default('console'),
    MESSAGE_CENTRAL_CUSTOMER_ID: z.string().optional(),
    MESSAGE_CENTRAL_KEY: z.string().optional(),
    // How long Message Central keeps a code ("Validity Time" in its dashboard; 60 s now).
    MESSAGE_CENTRAL_CODE_TTL_SECONDS: z.coerce.number().int().min(30).max(900).default(60),
    // MSG91 (after DLT registration): we make the code, MSG91 delivers it with this template.
    MSG91_AUTH_KEY: z.string().optional(),
    MSG91_TEMPLATE_ID: z.string().optional(),
    // Website push (W1): fcm = Firebase Cloud Messaging; console = test mode (logged only).
    // Default: fcm when the three server values below are set, otherwise console.
    PUSH_PROVIDER: z.enum(['fcm', 'console']).optional(),
    FIREBASE_PROJECT_ID: z.string().optional(),
    FIREBASE_CLIENT_EMAIL: z.string().optional(),
    FIREBASE_PRIVATE_KEY: z.string().optional(),
    // Public values the website needs to subscribe to push (handed out by /shop/config).
    FIREBASE_WEB_API_KEY: z.string().optional(),
    FIREBASE_WEB_AUTH_DOMAIN: z.string().optional(),
    FIREBASE_WEB_STORAGE_BUCKET: z.string().optional(),
    FIREBASE_WEB_MESSAGING_SENDER_ID: z.string().optional(),
    FIREBASE_WEB_APP_ID: z.string().optional(),
    FIREBASE_WEB_MEASUREMENT_ID: z.string().optional(),
    FIREBASE_WEB_VAPID_KEY: z.string().optional(),
    // Number of proxies in front of the app (nginx = 1), so req.ip is the phone's address.
    TRUST_PROXY: z.coerce.number().int().min(0).default(1),
    LOG_REQUESTS: z.enum(['true', 'false']).default('true'),
    RATE_LIMIT_PER_MINUTE: z.coerce.number().int().positive().default(60),
    // Where invited people download the admin app (store page or website). Optional:
    // without it the invite message just says to install the app.
    INVITE_APP_LINK: z.url().optional(),
    // Photos and PDFs (Module 3). local = a folder served at /uploads (development and
    // tests); s3 = the shop's Amazon S3 bucket (production).
    STORAGE_PROVIDER: z.enum(['local', 's3']).default('local'),
    LOCAL_STORAGE_DIR: z.string().default('uploads'),
    // The address phones use to reach this server, for links to local files.
    PUBLIC_URL: z.string().optional(),
    S3_BUCKET_NAME: z.string().optional(),
    S3_REGION: z.string().optional(),
    S3_PUBLIC_URL: z.string().optional(),
    S3_ACCESS_KEY_ID: z.string().optional(),
    S3_SECRET_ACCESS_KEY: z.string().optional(),
    // A test server sharing the shop's bucket keeps every file under this folder (e.g.
    // v2-test) and never deletes anything outside it: its copied data points at live photos.
    S3_KEY_PREFIX: z.string().regex(/^[a-z0-9][a-z0-9-]{1,40}$/, 'S3_KEY_PREFIX: lowercase letters, digits and dashes').optional(),
    // Old seed-time photos are stored as paths like /images/x.jpg on the website.
    WEBSITE_URL: z.string().optional(),
    // Module 5: the shop details printed on invoices, and the GST rate included in
    // every price. Same settings and defaults as the old backend.
    COMPANY_NAME: z.string().min(1).default('Nandam Handlooms'),
    COMPANY_ADDRESS: z.string().min(1).default('Hussain Katta, Mangalagiri, Andhra Pradesh, 522503, India'),
    COMPANY_MOBILE: z.string().min(1).default('+919494170180'),
    COMPANY_GSTIN: z.string().min(1).default('37CCWPN2487C1Z2'),
    GST_RATE_PERCENT: z.coerce.number().min(0).max(28).default(5),
    // Website W6 (decision 6.12): an online order delivered outside the shop's state gets IGST
    // on its invoice. Off until the accountant confirms; then true.
    GST_IGST_OTHER_STATES: z.enum(['true', 'false']).default('false'),
    SHOP_STATE: z.string().min(2).default('Andhra Pradesh'),
    // Website W6: online payment with Razorpay, the same account as the old backend.
    // razorpay = Razorpay's servers; fake = a stand-in for tests (no network, no money).
    // Payments stay off until PAYMENTS_ENABLED=true (and the keys are set).
    PAYMENTS_ENABLED: z.enum(['true', 'false']).default('false'),
    PAYMENT_PROVIDER: z.enum(['razorpay', 'fake']).default('razorpay'),
    RAZORPAY_KEY_ID: z.string().regex(/^rzp_(test|live)_[A-Za-z0-9]+$/, 'RAZORPAY_KEY_ID must start with rzp_test_ or rzp_live_').optional(),
    RAZORPAY_KEY_SECRET: z.string().min(8).optional(),
    RAZORPAY_WEBHOOK_SECRET: z.string().min(8).optional(),
    // Test keys on the live server take no money: refused unless this is set on purpose.
    PAYMENTS_ALLOW_TEST_KEYS_IN_PRODUCTION: z.enum(['true', 'false']).default('false'),
    // Online payment only for these signed-in customers' mobiles (comma-separated), while it is
    // being tried on the live website; everyone else orders on WhatsApp as before. Empty = all.
    // Test keys on the live server need it, so the public can never "pay" with test money...
    PAYMENTS_TESTERS: z.string().optional(),
    // ...unless the owner opens test payment to every visitor on purpose, while the website is
    // still being built (user, 26 Oct 2026). The website then says no real money is taken.
    PAYMENTS_TEST_FOR_EVERYONE: z.enum(['true', 'false']).default('false'),
    // The most one online payment may be (rupees): Razorpay's limit on the account. A bigger
    // bag is asked to order on WhatsApp instead of failing at Razorpay.
    PAYMENTS_MAX_AMOUNT: z.coerce.number().int().positive().default(500000),
    // Admin app notifications on iPhones go through Apple (APNs) with a push key (.p8) made in
    // the Apple Developer account; Android phones go through Firebase (FIREBASE_* above).
    APNS_KEY_ID: z.string().optional(),
    APNS_TEAM_ID: z.string().optional(),
    APNS_PRIVATE_KEY: z.string().optional(),
    APNS_BUNDLE_ID: z.string().default('com.nandamhandlooms.staff'),
    APNS_PRODUCTION: z.enum(['true', 'false']).default('true'), // TestFlight and App Store use production
  })
  .superRefine((v, ctx) => {
    if (v.SMS_PROVIDER === 'messagecentral' && (!v.MESSAGE_CENTRAL_CUSTOMER_ID || !v.MESSAGE_CENTRAL_KEY)) {
      ctx.addIssue({ code: 'custom', message: 'SMS_PROVIDER=messagecentral needs MESSAGE_CENTRAL_CUSTOMER_ID and MESSAGE_CENTRAL_KEY' });
    }
    if (v.NODE_ENV === 'production' && v.SMS_PROVIDER === 'console') {
      ctx.addIssue({ code: 'custom', message: 'SMS_PROVIDER=console is not allowed in production: codes would never be sent' });
    }
    if (v.STORAGE_PROVIDER === 's3' && (!v.S3_BUCKET_NAME || !v.S3_REGION)) {
      ctx.addIssue({ code: 'custom', message: 'STORAGE_PROVIDER=s3 needs S3_BUCKET_NAME and S3_REGION' });
    }
    if (v.NODE_ENV === 'production' && v.STORAGE_PROVIDER === 'local') {
      ctx.addIssue({ code: 'custom', message: 'STORAGE_PROVIDER=local is not allowed in production: photos would be lost on the next deploy' });
    }
    if (v.JWT_ACCESS_SECRET === v.JWT_STEP_SECRET) {
      ctx.addIssue({ code: 'custom', message: 'JWT_ACCESS_SECRET and JWT_STEP_SECRET must be different' });
    }
    if (v.JWT_SHOP_ACCESS_SECRET === v.JWT_ACCESS_SECRET || v.JWT_SHOP_ACCESS_SECRET === v.JWT_STEP_SECRET) {
      ctx.addIssue({ code: 'custom', message: 'JWT_SHOP_ACCESS_SECRET must be different from JWT_ACCESS_SECRET and JWT_STEP_SECRET' });
    }
    if (v.SMS_PROVIDER === 'msg91' && (!v.MSG91_AUTH_KEY || !v.MSG91_TEMPLATE_ID)) {
      ctx.addIssue({ code: 'custom', message: 'SMS_PROVIDER=msg91 needs MSG91_AUTH_KEY and MSG91_TEMPLATE_ID' });
    }
    if (v.NODE_ENV === 'production' && !v.SHOP_WEB_ORIGINS) {
      ctx.addIssue({ code: 'custom', message: 'SHOP_WEB_ORIGINS is required in production: the website addresses allowed to sign customers in' });
    }
    for (const o of (v.SHOP_WEB_ORIGINS || '').split(',').map((s) => s.trim()).filter(Boolean)) {
      if (!/^https?:\/\/[^/\s]+$/.test(o)) ctx.addIssue({ code: 'custom', message: `SHOP_WEB_ORIGINS: "${o}" must look like https://example.com (no path, no trailing slash)` });
    }
    if (v.PAYMENTS_ENABLED === 'true' && v.PAYMENT_PROVIDER === 'razorpay' && (!v.RAZORPAY_KEY_ID || !v.RAZORPAY_KEY_SECRET)) {
      ctx.addIssue({ code: 'custom', message: 'PAYMENTS_ENABLED=true needs RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET' });
    }
    if (v.NODE_ENV === 'production' && v.PAYMENT_PROVIDER === 'fake') {
      ctx.addIssue({ code: 'custom', message: 'PAYMENT_PROVIDER=fake is not allowed in production: no money would be taken' });
    }
    if (v.NODE_ENV === 'production' && v.PAYMENTS_ENABLED === 'true' && v.RAZORPAY_KEY_ID?.startsWith('rzp_test_') && v.PAYMENTS_ALLOW_TEST_KEYS_IN_PRODUCTION !== 'true') {
      ctx.addIssue({ code: 'custom', message: 'Razorpay TEST keys with PAYMENTS_ENABLED=true in production would take no money: use the live keys (or set PAYMENTS_ALLOW_TEST_KEYS_IN_PRODUCTION=true on purpose)' });
    }
    const testers = (v.PAYMENTS_TESTERS || '').split(',').map((s) => s.trim()).filter(Boolean);
    for (const t of testers) {
      if (!/^[6-9]\d{9}$/.test(t)) ctx.addIssue({ code: 'custom', message: `PAYMENTS_TESTERS: "${t}" must be a 10-digit Indian mobile number` });
    }
    if (v.NODE_ENV === 'production' && v.PAYMENTS_ENABLED === 'true' && v.RAZORPAY_KEY_ID?.startsWith('rzp_test_') && !testers.length && v.PAYMENTS_TEST_FOR_EVERYONE !== 'true') {
      ctx.addIssue({ code: 'custom', message: 'Razorpay TEST keys on the live server need PAYMENTS_TESTERS (the mobiles allowed to try paying), or PAYMENTS_TEST_FOR_EVERYONE=true on purpose: otherwise any customer could "pay" with test money' });
    }
    if (v.PUSH_PROVIDER === 'fcm' && (!v.FIREBASE_PROJECT_ID || !v.FIREBASE_CLIENT_EMAIL || !v.FIREBASE_PRIVATE_KEY)) {
      ctx.addIssue({ code: 'custom', message: 'PUSH_PROVIDER=fcm needs FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL and FIREBASE_PRIVATE_KEY' });
    }
  });

// A blank line (KEY=) counts as not set, so its default applies: one empty line copied from
// .env.example must never stop the server (and with it the website and the admin app).
const fromEnv = Object.fromEntries(Object.entries(process.env).map(([k, v]) => [k, typeof v === 'string' && !v.trim() ? undefined : v]));
const parsed = schema.safeParse(fromEnv);
if (!parsed.success) {
  const lines = parsed.error.issues.map((i) => `  - ${i.path.join('.') || 'config'}: ${i.message}`);
  // eslint-disable-next-line no-console
  console.error(`Invalid server settings:\n${lines.join('\n')}`);
  process.exit(1);
}

export const env = Object.freeze({
  ...parsed.data,
  isProduction: parsed.data.NODE_ENV === 'production',
  isTest: parsed.data.NODE_ENV === 'test',
  publicUrl: (parsed.data.PUBLIC_URL || `http://localhost:${parsed.data.PORT}`).replace(/\/$/, ''),
  company: Object.freeze({
    name: parsed.data.COMPANY_NAME,
    address: parsed.data.COMPANY_ADDRESS,
    mobile: parsed.data.COMPANY_MOBILE,
    gstin: parsed.data.COMPANY_GSTIN,
    gstRatePercent: parsed.data.GST_RATE_PERCENT,
    igstOtherStates: parsed.data.GST_IGST_OTHER_STATES === 'true',
    state: parsed.data.SHOP_STATE,
  }),
  // Website W6: online payment.
  payments: Object.freeze({
    enabled: parsed.data.PAYMENTS_ENABLED === 'true',
    provider: parsed.data.PAYMENT_PROVIDER,
    keyId: parsed.data.RAZORPAY_KEY_ID || (parsed.data.PAYMENT_PROVIDER === 'fake' ? 'rzp_test_fakeprovider' : null),
    keySecret: parsed.data.RAZORPAY_KEY_SECRET || null,
    webhookSecret: parsed.data.RAZORPAY_WEBHOOK_SECRET || null,
    mode: (parsed.data.RAZORPAY_KEY_ID || '').startsWith('rzp_live_') ? 'live' : 'test',
    maxAmount: parsed.data.PAYMENTS_MAX_AMOUNT,
    // Empty: every signed-in customer may pay online.
    testers: Object.freeze((parsed.data.PAYMENTS_TESTERS || '').split(',').map((s) => s.trim()).filter(Boolean)),
  }),
  biometricNeedsPin: parsed.data.BIOMETRIC_NEEDS_PIN === 'true',
  // Show SMS codes in API replies only when nothing is really sent and we are not live.
  echoCodes: parsed.data.SMS_PROVIDER === 'console' && parsed.data.NODE_ENV !== 'production',
  // Website (W1).
  shop: Object.freeze({
    origins: Object.freeze(
      (parsed.data.SHOP_WEB_ORIGINS || (parsed.data.NODE_ENV === 'production' ? '' : 'http://localhost:5173,http://127.0.0.1:5173'))
        .split(',').map((s) => s.trim()).filter(Boolean),
    ),
    cookieSecure: parsed.data.SHOP_COOKIE_SECURE ? parsed.data.SHOP_COOKIE_SECURE === 'true' : parsed.data.NODE_ENV === 'production',
    smsDailyLimit: parsed.data.SHOP_SMS_DAILY_LIMIT,
  }),
  push: Object.freeze({
    provider: parsed.data.PUSH_PROVIDER
      || (parsed.data.FIREBASE_PROJECT_ID && parsed.data.FIREBASE_CLIENT_EMAIL && parsed.data.FIREBASE_PRIVATE_KEY && parsed.data.NODE_ENV !== 'test' ? 'fcm' : 'console'),
    projectId: parsed.data.FIREBASE_PROJECT_ID || null,
    clientEmail: parsed.data.FIREBASE_CLIENT_EMAIL || null,
    // The key is kept on one line in .env with \n for each line break.
    privateKey: parsed.data.FIREBASE_PRIVATE_KEY ? parsed.data.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n') : null,
    // What the website needs to subscribe; null when push is not set up.
    web: parsed.data.FIREBASE_WEB_API_KEY && parsed.data.FIREBASE_WEB_APP_ID && parsed.data.FIREBASE_WEB_VAPID_KEY && parsed.data.FIREBASE_WEB_MESSAGING_SENDER_ID
      ? Object.freeze({
        apiKey: parsed.data.FIREBASE_WEB_API_KEY,
        authDomain: parsed.data.FIREBASE_WEB_AUTH_DOMAIN || null,
        projectId: parsed.data.FIREBASE_PROJECT_ID || null,
        storageBucket: parsed.data.FIREBASE_WEB_STORAGE_BUCKET || null,
        messagingSenderId: parsed.data.FIREBASE_WEB_MESSAGING_SENDER_ID,
        appId: parsed.data.FIREBASE_WEB_APP_ID,
        vapidKey: parsed.data.FIREBASE_WEB_VAPID_KEY,
      })
      : null,
    // The admin app on iPhones (Apple's push service); null until the push key is set.
    apns: parsed.data.APNS_KEY_ID && parsed.data.APNS_TEAM_ID && parsed.data.APNS_PRIVATE_KEY && parsed.data.NODE_ENV !== 'test'
      ? Object.freeze({
        keyId: parsed.data.APNS_KEY_ID,
        teamId: parsed.data.APNS_TEAM_ID,
        privateKey: parsed.data.APNS_PRIVATE_KEY.replace(/\\n/g, '\n'),
        bundleId: parsed.data.APNS_BUNDLE_ID,
        production: parsed.data.APNS_PRODUCTION === 'true',
      })
      : null,
  }),
});
