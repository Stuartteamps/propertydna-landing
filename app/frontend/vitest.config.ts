import { defineConfig } from 'vitest/config';

// Test config kept separate from vite.config.ts so the prerender/sitemap
// build pipeline is never pulled into the test run. Tests live in ./tests
// and may reach into ../../netlify/functions to cover server-side valuation
// logic (the highest-value code that the frontend build does not touch).
export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts'],
    environment: 'node',
  },
});
