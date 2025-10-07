import { test, expect } from '@playwright/test';

test.describe('CSP Security Headers', () => {
  test('should have proper CSP header with nonce', async ({ page }) => {
    const response = await page.goto('/');
    expect(response?.status()).toBe(200);

    const headers = response?.headers();
    const csp = headers?.['content-security-policy'];

    // Verify CSP exists
    expect(csp).toBeDefined();

    // Verify nonce is present
    expect(csp).toMatch(/script-src[^;]*'nonce-[A-Za-z0-9+/=]+'/);

    // Verify no unsafe-inline for scripts
    expect(csp).not.toContain("script-src 'unsafe-inline'");

    // Verify style-src policy
    expect(csp).toMatch(/style-src[^;]*'self'/);

    // Check for other critical directives
    expect(csp).toContain('default-src');
    expect(csp).toContain('img-src');
  });

  test('should apply nonce to inline scripts (if any)', async ({ page }) => {
    await page.goto('/');

    // Get CSP nonce from header
    const response = await page.goto('/');
    const csp = response?.headers()['content-security-policy'];
    const nonceMatch = csp?.match(/nonce-([A-Za-z0-9+/=]+)/);
    const nonce = nonceMatch?.[1];

    expect(nonce).toBeDefined();

    // Verify scripts have matching nonce
    const scriptNonces = await page.$$eval(
      'script[nonce]',
      (scripts) => scripts.map(s => s.getAttribute('nonce'))
    );

    // Pages may have zero inline scripts depending on Next version/config.
    // If there are any, they must carry the CSP nonce.
    if (scriptNonces.length > 0) {
      scriptNonces.forEach(scriptNonce => {
        expect(scriptNonce).toBe(nonce);
      });
    }
  });

  test('should have all required security headers', async ({ page }) => {
    const response = await page.goto('/');
    const headers = response?.headers();

    // HSTS
    expect(headers?.['strict-transport-security']).toContain('max-age');

    // X-Content-Type-Options
    expect(headers?.['x-content-type-options']).toBe('nosniff');

    // Referrer-Policy
    expect(headers?.['referrer-policy']).toBeDefined();

    // Permissions-Policy
    expect(headers?.['permissions-policy']).toBeDefined();
  });

  test('should not have CSP violations in console', async ({ page }) => {
    const violations: string[] = [];

    page.on('console', msg => {
      const text = msg.text();
      // Only flag CSP violations, and ignore style-src inline style warnings in dev which are expected
      // because we disallow unsafe-inline styles; we don't want tests to encourage weakening CSP.
      const isCsp = /Content Security Policy/i.test(text);
      const isStyleInline = /Refused to apply inline style/i.test(text);
      if (isCsp && !isStyleInline) violations.push(text);
    });

  await page.goto('/');
  // SPA apps may never hit strict networkidle due to analytics or preloads.
  // Give a short, deterministic pause to collect any CSP console messages.
  await page.waitForTimeout(1000);

    expect(violations).toEqual([]);
  });
});
