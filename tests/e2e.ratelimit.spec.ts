import { test, expect, request } from '@playwright/test';

const HOST = process.env.APP_HOST || 'http://localhost:3002';

test('Rate limit triggers after threshold', async () => {
  const ctx = await request.newContext({ baseURL: HOST, extraHTTPHeaders: { 'content-type': 'application/json' } });
  // Burst more than default limit (RATE_LIMIT default 20). We'll send 25 sequentially.
  const payload = { ideaText: 'Simple idea for testing rate limit' };
  const results = [] as number[];
  for (let i = 0; i < 25; i++) {
    const r = await ctx.post('/api/validate', { data: payload });
    results.push(r.status());
  }
  await ctx.dispose();
  const overLimit = results.filter((s) => s === 429).length;
  // Expect at least one 429
  expect(overLimit).toBeGreaterThan(0);
});
