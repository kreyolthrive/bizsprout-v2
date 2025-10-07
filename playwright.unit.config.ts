import { defineConfig } from '@playwright/test';

// Config for fast unit-like tests that don't require a running server
export default defineConfig({
  testDir: './tests',
  timeout: 30_000,
  retries: 0,
  use: { headless: true },
  // Run unit-style tests
  testMatch: [
    '**/inputSanitizer.spec.ts',
    '**/emailTiming.spec.ts',
    '**/pivots.artisan.spec.ts',
    '**/pdfLogoMode.spec.ts'
  ],
});
