import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  testMatch: 'e2e.ratelimit.spec.ts',
  timeout: 60_000,
  retries: process.env.CI ? 1 : 0,
  use: {
    headless: true,
    viewport: { width: 1280, height: 800 },
    ignoreHTTPSErrors: true,
    actionTimeout: 30_000,
    navigationTimeout: 30_000,
  },
  webServer: {
    // Build then start with limiter enabled (no DISABLE_RATELIMIT)
    command: 'sh -c "pnpm run build && PORT=3002 DISABLE_HTTPS_REDIRECT=1 pnpm start"',
    port: 3002,
  reuseExistingServer: false,
    timeout: 180_000,
  },
});
