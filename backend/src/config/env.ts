import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(3000),
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  JWT_ACCESS_SECRET: z.string().min(16, 'JWT_ACCESS_SECRET must be at least 16 characters'),
  JWT_REFRESH_SECRET: z.string().min(16, 'JWT_REFRESH_SECRET must be at least 16 characters'),
  JWT_ACCESS_EXPIRES_IN: z.string().default('15m'),
  // Sessions shouldn't outlive a day unattended — once the refresh token
  // expires, both apps' existing MPIN-login screens are the natural,
  // low-friction way back in (no full re-registration needed).
  JWT_REFRESH_EXPIRES_IN: z.string().default('1d'),
  FRONTEND_URL: z.string().default('http://localhost:5173'),
  // Extra origins the CORS allowlist should accept besides FRONTEND_URL,
  // comma-separated — e.g. a dev machine's LAN address so customer-web can
  // also be opened directly from another device's browser without going
  // through Vite's dev proxy. FRONTEND_URL itself stays a single URL (other
  // code, e.g. fetchImageBuffer, builds absolute links from it).
  CORS_ALLOWED_ORIGINS: z.string().optional(),
  SMS_PROVIDER: z.string().default('console'),
  // MSG91 (see providers/sms/msg91.provider.ts) — optional until
  // SMS_PROVIDER=msg91 is set; AUTH_KEY+TEMPLATE_ID are required at that
  // point (enforced in providers/sms/index.ts), SENDER_ID is documentation
  // only (the template's sender is configured in the MSG91 dashboard).
  MSG91_AUTH_KEY: z.string().optional(),
  MSG91_SENDER_ID: z.string().optional(),
  MSG91_TEMPLATE_ID: z.string().optional(),
  SEED_ADMIN_NAME: z.string().optional(),
  SEED_ADMIN_EMAIL: z.string().optional(),
  SEED_ADMIN_MOBILE: z.string().optional(),
  SEED_ADMIN_MPIN: z.string().optional(),

  RAZORPAY_KEY_ID: z.string().optional(),
  RAZORPAY_KEY_SECRET: z.string().optional(),
  // Separate secret configured in the Razorpay dashboard's webhook settings
  // — not the same as RAZORPAY_KEY_SECRET. Without it, the webhook endpoint
  // stays disabled (client-driven verify-payment still works on its own).
  RAZORPAY_WEBHOOK_SECRET: z.string().optional(),

  // console | local | s3. `local` writes to LOCAL_STORAGE_DIR and serves
  // the files back from the API itself — that is what makes a fresh clone
  // work with no cloud account on any machine.
  STORAGE_PROVIDER: z.string().default('console'),
  S3_BUCKET_NAME: z.string().optional(),
  S3_REGION: z.string().optional(),
  S3_PUBLIC_URL: z.string().optional(),
  // Read explicitly rather than leaning on the AWS SDK's ambient credential
  // chain (~/.aws/credentials, machine-level AWS_* vars, instance roles).
  // That chain is why uploads worked on one laptop and failed with an
  // opaque 500 on another: the bucket/region were in .env, so the provider
  // reported itself configured, but the actual PutObject had no credentials
  // to sign with. Keeping them in .env means the config travels with the
  // project. The SDK's own chain is still the fallback when these are unset,
  // which is what a deployed instance role wants.
  S3_ACCESS_KEY_ID: z.string().optional(),
  S3_SECRET_ACCESS_KEY: z.string().optional(),
  // Where STORAGE_PROVIDER=local keeps uploads, relative to the backend dir.
  LOCAL_STORAGE_DIR: z.string().default('uploads'),
  // Absolute base URL this API is reachable at, used to build public URLs
  // for locally-stored uploads. Defaults to localhost:PORT; set it to the
  // dev machine's LAN address when a phone has to load those images.
  PUBLIC_API_URL: z.string().optional(),

  // 10 unique letters mapping to digits 0-9, for the "coded price" label
  // option — only the owner should know this word. Default is a placeholder;
  // change it in production so a stranger can't read prices off a tag.
  PRICE_CODE_WORD: z.string().default('BLACKHORSE'),

  // Invoice/GST — defaults match the business's actual registration so
  // invoices work out of the box; override without a code change if the
  // rate or registration details ever change.
  GST_RATE_PERCENT: z.coerce.number().positive().default(5),
  COMPANY_NAME: z.string().default('Nandam Handlooms'),
  COMPANY_ADDRESS: z.string().default('Hussain Katta, Mangalagiri, Andhra Pradesh, 522503, India'),
  COMPANY_MOBILE: z.string().default('+919494170180'),
  COMPANY_GSTIN: z.string().default('37CCWPN2487C1Z2'),
  // Same object the RN app's BRAND_LOGO_URL already points at — a fixed
  // media bucket, unrelated to STORAGE_PROVIDER/S3_BUCKET_NAME above (that
  // one is for product/catalog/invoice uploads). Override only if that
  // media bucket ever moves.
  COMPANY_LOGO_URL: z.string().default('https://nandamhandlooms-media.s3.ap-south-1.amazonaws.com/site/brand/logo.png'),
});

function loadEnv() {
  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    console.error('Invalid environment configuration:');
    for (const issue of parsed.error.issues) {
      console.error(`  - ${issue.path.join('.')}: ${issue.message}`);
    }
    process.exit(1);
  }
  return parsed.data;
}

export const env = loadEnv();
export const isProduction = env.NODE_ENV === 'production';
