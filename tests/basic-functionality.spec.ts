import { test, expect } from '@playwright/test';

test.describe('Basic BizSprout Functionality', () => {
  test('page loads correctly and shows validation form', async ({ page }) => {
    await page.goto('/');
    
    // Check that the main heading is visible
    await expect(page.getByRole('heading', { name: /Validate your idea/i })).toBeVisible();
    
    // Check that the validation textarea is present
    await expect(page.locator('#ideaInput')).toBeVisible();
    
    // Check that the validate button is present
    await expect(page.getByRole('button', { name: /Validate My Idea/i })).toBeVisible();
  });

  test('validation form accepts input', async ({ page }) => {
    await page.goto('/');
    
    // Enter a test idea
    const ideaInput = page.locator('#ideaInput');
    await ideaInput.fill('A subscription service for handmade artisanal soaps delivered monthly');
    
    // Check that the validate button is enabled
    const validateButton = page.getByRole('button', { name: /Validate My Idea/i });
    await expect(validateButton).toBeEnabled();
    
    // Note: We won't actually submit since it requires API calls
    // but we've verified the form accepts input
  });

  test('waitlist form works', async ({ page }) => {
    await page.goto('/');
    
    // Find the email input in the hero section
    const emailInput = page.locator('.email-form input[type="email"]');
    await emailInput.fill('test@example.com');
    
    // Submit the form
    const submitButton = page.locator('.email-form button[type="submit"]');
    await submitButton.click();
    
    // Check for success message (this should appear even if the API call fails)
    await expect(page.locator('.success')).toBeVisible({ timeout: 10000 });
  });
});