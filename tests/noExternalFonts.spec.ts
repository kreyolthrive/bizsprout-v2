import { test, expect } from '@playwright/test';

// Ensures that no external Google Fonts requests occur after self-host migration.
// If any request to fonts.googleapis.com or fonts.gstatic.com happens, fail the test.

test('no external Google Fonts network requests', async ({ page }) => {
  const deniedHosts: string[] = [];
  page.on('request', (req) => {
    const url = req.url();
    if (url.includes('fonts.googleapis.com') || url.includes('fonts.gstatic.com')) {
      deniedHosts.push(url);
    }
  });
  await page.goto('/');
  // small wait to allow late-loading resources (if any)
  await page.waitForTimeout(1000);
  expect(deniedHosts, `Unexpected external font requests: \n${deniedHosts.join('\n')}`).toHaveLength(0);
});
