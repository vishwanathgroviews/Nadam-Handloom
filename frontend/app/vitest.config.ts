import { defineConfig } from 'vitest/config';

// Deliberately minimal: only the pure, dependency-free logic under
// src/utils/*.test.ts is covered this way (see concurrencyGuards.ts) — this
// app has no React Native component test setup (no jest-expo), so anything
// that needs to render a screen or drive expo-camera stays a manual/device
// test, not a unit test.
export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    include: ['src/**/*.test.ts'],
  },
});
