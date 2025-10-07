import { test, expect } from '@playwright/test';

// Lightweight API tests using Playwright's request context
// Assumes dev server is running separately when using the default playwright.config.ts

const HOST = process.env.APP_HOST || 'http://localhost:3002';

test.describe('API: /api/validate-input', () => {
  test('rejects XSS <script> payloads', async ({ request }) => {
    const res = await request.post(`${HOST}/api/validate-input`, {
      headers: { 'content-type': 'application/json' },
      data: {
        ideaText: "<script>alert('x')</script> mobile app",
        email: 'User@Example.com',
        userId: ' user-123 '
      },
    });
    expect(res.status()).toBe(400);
  });

  test('accepts safe input and sanitizes harmless HTML, normalizes email', async ({ request }) => {
    const res = await request.post(`${HOST}/api/validate-input`, {
      headers: { 'content-type': 'application/json' },
      data: {
        ideaText: 'Mobile app <b>for</b> fitness & wellness',
        email: 'User@Example.com',
        userId: ' user-123 '
      },
    });
    expect(res.status()).toBe(200);
    const json = await res.json();
    expect(json.ok).toBeTruthy();
    expect(json.sanitized.ideaText).toContain('&lt;b&gt;');
    expect(json.sanitized.ideaText).not.toContain('<script');
    expect(json.sanitized.email).toBe('user@example.com');
  });

  test('rejects invalid payload', async ({ request }) => {
    const res = await request.post(`${HOST}/api/validate-input`, {
      headers: { 'content-type': 'application/json' },
      data: { ideaText: 'a' },
    });
    expect(res.status()).toBe(400);
  });
});
