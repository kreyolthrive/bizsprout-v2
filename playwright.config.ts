import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: '.',
  // Keep flows stable: ignore specs that require different server knobs or are variant-sensitive
  testIgnore: [
    'tests/e2e.ratelimit.spec.ts',
    'tests/duplicate-limit.api.spec.ts',
    'tests/pivot-mode.spec.ts',
    // Ensure stray starter test never runs (might exist locally)
    'tests/hello-world.spec.ts'
  ],
  timeout: 60_000,
  retries: process.env.CI ? 1 : 0,
  use: {
    headless: true,
    viewport: { width: 1280, height: 800 },
    ignoreHTTPSErrors: true,
    actionTimeout: 30_000,
    navigationTimeout: 30_000,
    baseURL: 'http://localhost:3002',
  },
  webServer: {
    // Build then start so pages and API routes are available
    command: 'sh -c "pnpm run build && PORT=3002 DISABLE_RATELIMIT=1 DISABLE_HTTPS_REDIRECT=1 DISABLE_DUPLICATE_LIMITER=1 pnpm start"',
    port: 3002,
  reuseExistingServer: false,
    timeout: 180_000,
  },
});
