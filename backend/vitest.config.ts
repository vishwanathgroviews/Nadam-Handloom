import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    include: ['src/**/*.test.ts'],
    setupFiles: ['src/test/setupEnv.ts'],
    // These are full request-level flow tests, and auth paths deliberately
    // run argon2 — a single login is ~300-400ms by design, and a test that
    // exercises several is comfortably over a second of pure hashing. The
    // 5s default leaves no headroom for that on a loaded machine and shows
    // up as a timeout in an unrelated-looking test rather than a real
    // failure, so the budget is raised to match what these tests actually do.
    testTimeout: 30000,
    hookTimeout: 30000,
  },
});
