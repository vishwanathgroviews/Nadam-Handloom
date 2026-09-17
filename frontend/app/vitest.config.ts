import { defineConfig } from 'vitest/config';

// Covers the pure logic under src/utils (see concurrencyGuards.ts,
// scanStabilizer.ts) and the API client, whose few Expo/RN imports are
// configuration only and are stubbed in its test. There is no React Native
// component test setup (no jest-expo), so anything that has to render a
// screen or drive expo-camera stays a manual/device test.
export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    include: ['src/**/*.test.ts'],
  },
});
