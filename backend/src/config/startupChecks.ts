import { env } from './env';
import { storageProvider } from '../providers/storage';
import { paymentProvider } from '../providers/payment';

/**
 * Prints, at boot, exactly which optional integrations are live and which
 * are not — and for storage, *why*.
 *
 * A second machine running this code hit "server issue" on every image
 * upload with nothing in the logs to explain it: `.env` carried
 * S3_BUCKET_NAME and S3_REGION, so the provider reported itself configured,
 * but the AWS SDK had no credentials to sign with (they had been coming
 * from the original laptop's ambient ~/.aws config). The failure only
 * surfaced as a 500 halfway through an upload. Saying it out loud at
 * startup turns that into a one-line fix.
 */
export function logIntegrationStatus(): void {
  const lines: string[] = [];

  // ── Storage ──────────────────────────────────────────────────────────
  const provider = env.STORAGE_PROVIDER;
  if (provider === 's3') {
    const missing: string[] = [];
    if (!env.S3_BUCKET_NAME) missing.push('S3_BUCKET_NAME');
    if (!env.S3_REGION) missing.push('S3_REGION');
    if (missing.length) {
      lines.push(`  storage:  s3 — NOT USABLE, missing ${missing.join(', ')}. Image upload will fail.`);
    } else if (!env.S3_ACCESS_KEY_ID || !env.S3_SECRET_ACCESS_KEY) {
      lines.push(
        '  storage:  s3 — bucket set, but S3_ACCESS_KEY_ID/S3_SECRET_ACCESS_KEY are not. ' +
          'Falling back to the AWS SDK credential chain (~/.aws, AWS_* vars, instance role). ' +
          'If uploads fail with a credentials error, set those two in .env, ' +
          'or use STORAGE_PROVIDER=local to work without a cloud account.'
      );
    } else {
      lines.push(`  storage:  s3 — bucket "${env.S3_BUCKET_NAME}" (${env.S3_REGION}), credentials from .env`);
    }
  } else if (provider === 'local') {
    lines.push(
      `  storage:  local — files in ./${env.LOCAL_STORAGE_DIR}, served from ` +
        `${env.PUBLIC_API_URL || `http://localhost:${env.PORT}`}/uploads. Development only.`
    );
  } else {
    lines.push(
      `  storage:  ${provider} — NO uploads possible. Set STORAGE_PROVIDER=local ` +
        'for a working dev setup, or s3 with credentials.'
    );
  }

  // ── Payments ─────────────────────────────────────────────────────────
  if (!paymentProvider.isConfigured()) {
    lines.push('  payments: razorpay — NOT configured (RAZORPAY_KEY_ID/RAZORPAY_KEY_SECRET). Checkout will 503.');
  } else {
    const mode = env.RAZORPAY_KEY_ID?.startsWith('rzp_live_') ? 'LIVE' : 'test';
    const webhook = env.RAZORPAY_WEBHOOK_SECRET
      ? 'webhook enabled'
      : 'webhook DISABLED (RAZORPAY_WEBHOOK_SECRET unset) — payment confirmation relies on the client callback alone';
    lines.push(`  payments: razorpay ${mode} — ${webhook}`);
  }

  // ── SMS ──────────────────────────────────────────────────────────────
  lines.push(
    env.SMS_PROVIDER === 'console'
      ? '  sms:      console — OTPs are printed to this log, not delivered'
      : `  sms:      ${env.SMS_PROVIDER}`
  );

  console.log(`Integrations (NODE_ENV=${env.NODE_ENV}):`);
  for (const line of lines) console.log(line);

  // Cheap sanity check that the wiring above matches reality.
  if (provider !== 'console' && !storageProvider.isConfigured()) {
    console.warn('  ! storageProvider.isConfigured() is false — uploads will be rejected with a 503.');
  }
}
