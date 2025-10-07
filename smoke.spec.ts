import { test, expect } from "@playwright/test";
test("home loads and waitlist works", async ({ page }) => {
  await page.goto("http://localhost:3002/");
  await page.waitForLoadState("domcontentloaded");
  await page.request.post("http://localhost:3002/api/waitlist", { headers: { 'content-type': 'application/json' }, data: { email: `pw+${Date.now()}@example.com` } })
  .then(r => expect([200,201]).toContain(r.status()));
});
