// Starts the Nandam Handlooms API v2.
import { env } from './src/config/env.js';
import { createApp } from './src/app.js';
import { disconnectDatabase } from './src/config/database.js';
import { startCleanupJob } from './src/jobs/cleanup.job.js';
import { startPaymentJobs } from './src/jobs/payments.job.js';

const app = createApp();
const server = app.listen(env.PORT, env.HOST, () => {
  console.log(`Nandam API v2 listening on ${env.HOST || 'every address'}:${env.PORT} (${env.NODE_ENV}, SMS: ${env.SMS_PROVIDER}, payments: ${env.payments.enabled ? `${env.payments.provider} ${env.payments.mode}` : 'off'}${env.S3_KEY_PREFIX ? `, files under ${env.S3_KEY_PREFIX}/` : ''})`);
});
startCleanupJob();
startPaymentJobs();

// Finish in-flight requests, then close the database, on stop or restart.
function shutdown(signal) {
  console.log(`${signal} received, shutting down`);
  server.close(async () => {
    await disconnectDatabase();
    process.exit(0);
  });
  setTimeout(() => process.exit(1), 10_000).unref();
}
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
