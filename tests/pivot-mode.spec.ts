import { test, expect } from '@playwright/test';

test.describe('Pivot vs Improvement mode UI', () => {
  test('explainer appears in Pivot mode and ROI tools are hidden', async ({ page }) => {
    await page.goto('http://localhost:3002/');
    await page.waitForLoadState('domcontentloaded');

    // Kick a minimal validation to render the Recommended path block
  const ideaBox = page.getByRole('textbox', { name: /Describe Your Business Idea/i });
  const validateBtn = page.getByTestId('validate-submit');
    if (await ideaBox.count()) {
  await ideaBox.fill('Simple project management tool for contractors with mobile app');
  await expect(page.getByTestId('validate-submit')).toBeEnabled();
      await validateBtn.click();
      // Wait for either result banners or recommended path toggle to show
      await expect(page.locator('text=Recommended path')).toBeVisible({ timeout: 30000 });
    } else {
      // If landing variant differs, still proceed to check blocks after initial content loads
      await page.waitForTimeout(1500);
    }

  // Ensure the toggle link is present (prefer stable testid; fallback to text)
  const explorePivot = page.locator('[data-testid="toggle-recommended-view"], [data-testid="see-pivot-picks"], button:has-text("Explore pivot view")');
  await expect(explorePivot.first()).toBeVisible();

  // Switch to Pivot view
  await explorePivot.first().click();

  // Expect the Pivot-mode explainer text (scope to Recommended path card)
  const recommendedCard = page.locator('text=Recommended path').locator('..').first();
  await expect(recommendedCard.getByText('Showing: Option B — Pivot')).toBeVisible({ timeout: 15000 });
  await expect(recommendedCard.getByText('Improvement experiment targets and ROI tools are hidden')).toBeVisible();

  // ROI calculator section should be hidden in Pivot mode
  await expect(page.locator('text=Paid pilot ROI')).toBeHidden({ timeout: 2000 });

    // Switch back to Improvement mode via the same toggle
  const exploreImprove = page.locator('[data-testid="toggle-recommended-view"], [data-testid="show-improvement-anyway"], button:has-text("Explore improvement view")');
  await exploreImprove.first().click();

  // In Improvement mode, ROI section should become visible
  await expect(page.locator('text=Paid pilot ROI')).toBeVisible({ timeout: 15000 });
  });
});
