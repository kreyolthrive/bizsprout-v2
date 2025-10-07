import { test, expect } from '@playwright/test';
import { validateEmail } from '@/lib/security/email';

// Unit-style test (picked up by playwright.unit.config.ts if we include it)
test('Prevents timing attacks on email validation', async () => {
  const trials = 5; // average to reduce noise
  let tValid = 0;
  let tInvalid = 0;

  for (let i = 0; i < trials; i++) {
    const s1 = Date.now();
    await validateEmail('valid@example.com');
    tValid += (Date.now() - s1);

    const s2 = Date.now();
    await validateEmail('invalid-email');
    tInvalid += (Date.now() - s2);
  }

  const time1 = tValid / trials;
  const time2 = tInvalid / trials;

  // Timing difference should be minimal (allowing small jitter)
  expect(Math.abs(time1 - time2)).toBeLessThan(50);
});
