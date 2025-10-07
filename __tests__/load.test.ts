/**
 * Basic concurrency test for /api/validate using Playwright's request fixture.
 * Expects the dev server or the Playwright webServer (in playwright.config.ts) to be running.
 */
import { test, expect, request } from '@playwright/test';

// Make the host configurable; default to local Playwright server (3002 per config)
const HOST = process.env.APP_HOST || 'http://localhost:3002';

type WarmContext = { ctx: import('@playwright/test').APIRequestContext, csrfToken?: string };
// Create one context, warm up CSRF cookie, and extract token if present
async function createWarmContext(baseURL: string): Promise<WarmContext> {
  const ctx = await request.newContext({ baseURL, extraHTTPHeaders: { 'content-type': 'application/json' } });
  await ctx.get('/api/validate'); // may set CSRF cookie; ignore result
  let csrfToken: string | undefined;
  try {
    const state = await ctx.storageState();
    const cookie = state.cookies.find(c => c.name === 'csrf_token');
    csrfToken = cookie?.value;
  } catch {}
  return { ctx, csrfToken };
}

// The user's requested test
test('Handles 50 concurrent validations', async () => {
  const { ctx, csrfToken } = await createWarmContext(HOST);
  const payload = { ideaText: 'Mobile app for fitness' };
  const headers = csrfToken ? { 'x-csrf-token': csrfToken } : undefined;
  const promises = Array.from({ length: 50 }, () => ctx.post('/api/validate', { data: payload, headers }));
  const results = await Promise.all(promises);
  await ctx.dispose();
  const successful = results.filter(r => r.ok());
  expect(successful.length).toBeGreaterThan(45); // 90%+ success
});
