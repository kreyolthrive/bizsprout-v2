import { test, expect } from '@playwright/test';

interface FastOverrideWindow extends Window { __ALLOW_FAST_PDF?: boolean; __pdfFailOnce?: boolean }

async function openHarness(page, fast = true) {
  // Force-enable fast mode even if production build by setting override before any scripts run.
  await page.addInitScript(() => { (window as FastOverrideWindow).__ALLOW_FAST_PDF = true; });
  const fastFlag = fast ? '&pdfTestFast=1' : '';
  await page.goto('/?testAutoResult=1&pdfDebug=1' + fastFlag);
  await expect(page.getByRole('heading', { name: 'Your free report is ready!' })).toBeVisible();
}

async function waitForStatus(page, target: 'success' | 'fail', timeoutMs = 20000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const debugRoot = page.locator('text=PDF Debug').locator('..');
    if (await debugRoot.count()) {
      const text = await debugRoot.innerText();
      if (target === 'success' && /Status:\s*success/i.test(text)) return;
      if (target === 'fail' && /Status:\s*fail/i.test(text)) return;
    }
    await page.waitForTimeout(250);
  }
  throw new Error(`Timed out waiting for status ${target}`);
}

test.describe('Validation Report Download', () => {
  test('generates PDF successfully (polling)', async ({ page }) => {
    await openHarness(page);
    await page.getByRole('button', { name: 'Download Report' }).click();
    await waitForStatus(page, 'success');
    await expect(page.getByRole('button', { name: 'Download Report' })).toBeEnabled();
  });

  test('first attempt fails then retry succeeds', async ({ page }) => {
    await openHarness(page);
    await page.evaluate(() => { (window as unknown as { __pdfFailOnce?: boolean }).__pdfFailOnce = true; });
    await page.getByRole('button', { name: 'Download Report' }).click();
    await waitForStatus(page, 'fail');
    await expect(page.locator('text=PDF generation failed').first()).toBeVisible({ timeout: 10000 });
    const retry = page.getByRole('button', { name: 'Retry PDF' });
    await expect(retry).toBeVisible();
    await retry.click();
    await waitForStatus(page, 'success');
  });
});
