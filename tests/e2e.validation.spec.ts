import { test, expect } from '@playwright/test';

const HOST = process.env.APP_HOST || 'http://localhost:3002';

test.describe('Validation critical paths', () => {
  test('submits an idea and navigates to results (id or fallback)', async ({ page }) => {
    await page.goto(`${HOST}/`);
    await page.waitForLoadState('domcontentloaded');

    // Fill idea input (role/label-based selector for resilience) and submit
    await page.getByRole('textbox', { name: /Describe Your Business Idea/i })
      .fill('Monthly coffee subscription box at $35/month with curated beans and tasting notes');
    // Button is disabled until >=10 chars; ensure it becomes enabled
    const submit = page.getByTestId('validate-submit');
    await expect(submit).toBeEnabled();
    await submit.click();

    // Expect navigation to results page (either /results/:id or /results?score=...)
    await page.waitForURL(/\/results(\/.+)?(\?.*)?$/, { timeout: 30_000 });
    await expect(page.getByRole('heading', { name: /Validation Results/i })).toBeVisible();
  });

  test('API returns 400 on missing idea', async ({ request }) => {
    const res = await request.post(`${HOST}/api/validate`, {
      headers: { 'content-type': 'application/json' },
      data: {}
    });
    expect(res.status()).toBe(400);
    const json = await res.json();
    expect(json.error).toMatch(/Idea description is required/i);
  });
});
