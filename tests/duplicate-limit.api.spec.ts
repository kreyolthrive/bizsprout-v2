import { test, expect } from '@playwright/test';

const HOST = process.env.APP_HOST || 'http://localhost:3002';

test.describe('Duplicate submission limiter', () => {
  test('blocks after repeated identical ideaText', async ({ request }) => {
    test.skip(process.env.DISABLE_DUPLICATE_LIMITER === '1', 'Duplicate limiter disabled for this run');
    const payload = {
      ideaText: 'Simple invoicing app for contractors',
      email: 'dup@example.com',
      userId: 'rate-user-1'
    };

    const h = { 'content-type': 'application/json' } as const;
    const r1 = await request.post(`${HOST}/api/validate-input`, { headers: h, data: payload });
    expect(r1.status()).toBe(200);

    const r2 = await request.post(`${HOST}/api/validate-input`, { headers: h, data: payload });
    expect(r2.status()).toBe(200);

    const r3 = await request.post(`${HOST}/api/validate-input`, { headers: h, data: payload });
    expect(r3.status()).toBe(429);
    const j = await r3.json();
    expect(j?.message || '').toMatch(/Duplicate submission detected/i);
  });
});
