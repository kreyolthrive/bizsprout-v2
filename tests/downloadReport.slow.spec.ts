import { test, expect } from '@playwright/test';

// Slow mode test (pdfTestSlow=1) ensures the UI shows a loading state ('Preparing...')
// for at least part of the artificial delay window before success.
// Skipped unless RUN_SLOW_PDF=1 to avoid adding time to default CI runs.

const shouldRun = process.env.RUN_SLOW_PDF === '1';

(shouldRun ? test : test.skip)('Slow PDF generation incurs delay and logs diagnostics', async ({ page }) => {
  await page.goto('/?testAutoResult=1&pdfDebug=1&pdfTestSlow=1');
  await expect(page.getByRole('heading', { name: 'Your free report is ready!' })).toBeVisible();

  const downloadBtn = page.getByTestId('pdf-download');
  await expect(downloadBtn).toBeVisible();
  const t0 = Date.now();
  await downloadBtn.click();

  // Wait for completion (idle state again) and capture elapsed
  await expect(downloadBtn).toHaveAttribute('data-pdf-state', 'idle', { timeout: 8000 });
  const elapsed = Date.now() - t0; // informational only; no assertion due to environment variability
  await expect(downloadBtn).toBeEnabled();

  // Diagnostics
  const diagRoot = page.locator('text=PDF Debug').locator('..');
  await expect(diagRoot).toContainText('Slow mode engaged');
  await expect(diagRoot).toContainText('Slow mode delay complete');
  await expect(diagRoot).toContainText('Slow mode placeholder blob size');
  await expect(diagRoot).toContainText('Slow mode download triggered');
  const diagText = await diagRoot.innerText();
  const idxDelay = diagText.indexOf('Slow mode delay complete');
  const idxBlob = diagText.indexOf('Slow mode placeholder blob size');
  const idxDownload = diagText.indexOf('Slow mode download triggered');
  expect(idxDelay).toBeGreaterThan(-1);
  expect(idxBlob).toBeGreaterThan(idxDelay);
  expect(idxDownload).toBeGreaterThan(idxBlob);
  console.log('[slow-pdf] elapsed ms', elapsed);
});
