// Tests run against nandam_test, a fresh copy of the local nandam_dev database,
// re-made before every run. Never against the live database.
import { defineConfig } from 'vitest/config';

const user = process.env.USER || 'adusumillisrisumanthgmail.com';
export default defineConfig({
  test: {
    environment: 'node',
    globalSetup: ['tests/support/global-setup.js'],
    fileParallelism: false,
    testTimeout: 30000,
    hookTimeout: 120000,
    env: {
      NODE_ENV: 'test',
      DATABASE_URL: `postgresql://${user}@localhost:5432/nandam_test`,
      JWT_ACCESS_SECRET: 'test-access-secret-0123456789abcdef0123456789',
      JWT_STEP_SECRET: 'test-step-secret-0123456789abcdef0123456789ab',
      JWT_SHOP_ACCESS_SECRET: 'test-shop-secret-0123456789abcdef0123456789',
      SHOP_WEB_ORIGINS: 'http://shop.test,http://localhost:5173',
      SHOP_COOKIE_SECURE: 'false',
      SHOP_WEB_INDEX: 'tmp/test-web/index.html', // written by tests/api/shop/page.test.js
      PUSH_PROVIDER: 'console',
      SMS_PROVIDER: 'console',
      RATE_LIMIT_PER_MINUTE: '100000',
      LOG_REQUESTS: 'false',
      STORAGE_PROVIDER: 'local',
      LOCAL_STORAGE_DIR: 'tmp/test-uploads',
      PUBLIC_URL: 'http://test.local:4100',
      // Website W6: payments on, with the stand-in for Razorpay (no network, no money).
      PAYMENTS_ENABLED: 'true',
      PAYMENT_PROVIDER: 'fake',
      RAZORPAY_KEY_ID: 'rzp_test_fakeprovider01',
      RAZORPAY_KEY_SECRET: 'test_key_secret_0123456789abcdef',
      RAZORPAY_WEBHOOK_SECRET: 'test_webhook_secret_0123456789abcdef',
    },
  },
});
