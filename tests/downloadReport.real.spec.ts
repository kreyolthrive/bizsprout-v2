import { test, expect } from '@playwright/test';

// Real (non-fast) PDF generation test.
// Skipped unless RUN_REAL_PDF=1 is set in the environment (useful for scheduled / nightly builds).
// Ensures the heavy React-PDF pipeline still works end-to-end.

const shouldRun = process.env.RUN_REAL_PDF === '1';

(shouldRun ? test : test.skip)('Real PDF generation produces a downloadable file and success diagnostics', async ({ page }) => {
  await page.goto('/?dummyRealPdf=1');

  // Navigate or trigger whatever steps are required before PDF button appears; adapt if flow changes.
  // Assuming primary CTA triggers generation after an idea is validated; re-use logic from fast test.

  // Fill minimal required fields if landing form exists (guard in case layout changes)
  const ideaInput = page.locator('textarea[name="idea"], textarea#idea');
  if (await ideaInput.count()) {
    await ideaInput.fill('Test idea for full PDF path');
  }
  const submitBtn = page.getByRole('button', { name: /validate/i });
  if (await submitBtn.count()) {
    await submitBtn.click();
  }

  // Wait for result step (heuristic: presence of Download PDF button)
  const downloadBtn = page.getByRole('button', { name: /download pdf/i });
  await downloadBtn.waitFor({ timeout: 30000 });

  // Attach listener for download event (real pipeline should emit a browser download)
  const [ download ] = await Promise.all([
    page.waitForEvent('download', { timeout: 60000 }),
    downloadBtn.click()
  ]);

  const suggestedName = download.suggestedFilename();
  expect(suggestedName).toMatch(/BizSproutAI-Validation-Report-.*\.pdf$/);

  // (Optional) Retrieve temporary path (not always needed, but ensures Playwright fully processed the artifact)
  const path = await download.path();
  expect(path).toBeTruthy();

  // Poll diagnostic UI to confirm success state (pdfDiag.success === true)
  const start = Date.now();
  let success = false; let lastText = '';
  while (Date.now() - start < 30000) {
    const diag = page.locator('[data-test="pdf-diag"]');
    if (await diag.count()) {
      lastText = (await diag.innerText()).toLowerCase();
      if (lastText.includes('success: true') || lastText.includes('success=true')) { success = true; break; }
    }
    await page.waitForTimeout(500);
  }
  expect(success, `Expected pdfDiag success within 30s. Last diag text: ${lastText}`).toBeTruthy();
});
