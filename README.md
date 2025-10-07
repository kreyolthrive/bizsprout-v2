This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

![CI](https://img.shields.io/badge/ci-matrix--node-blue?logo=githubactions)
![Coverage](https://img.shields.io/badge/coverage-pending-lightgrey)

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

## Performance Testing and Gates

Use the following scripts to run k6 load tests and enforce performance gates via `pnpm` scripts:

```bash
# Happy-path gates (no 429s expected)
MAX_429_RATE=0 REQUIRE_429=0 pnpm run ci:perf

# Rate-limit scenario (expect some 429s, cap at 5%)
REQUIRE_429=1 MAX_429_RATE=0.05 pnpm run ci:perf

# Tighter latency bound
P95_MS=200 pnpm run check:k6
```

### Inspect rate-limit spikes

To quickly surface limiter events in recent server logs:

```bash
tail -n 200 server-rl.log | egrep '"msg":"(rate-limit-exceeded|duplicate-idea-block)"' || true
```

You can also watch in real time:

```bash
tail -f server-rl.log | egrep '"msg":"(rate-limit-exceeded|duplicate-idea-block)"'
```


## Production Smoke Testing

Run a quick smoke check against your built production app:

```bash
bash scripts/smoke-production.sh
```

## Fast Local Pre-Push Check

Run a lightweight gate (typecheck + fonts presence) before opening a PR:

```bash
pnpm run ci:quick
```

If fonts are missing the script will currently continue (non-blocking); make it blocking later by updating the CI workflow to remove the fallback `|| echo` pattern.

## Merge Gate Setup

Enable required checks in repository settings (Settings → Branches → Branch protection rules) and require at least:

- `lint`
- `build-matrix` (ensures type + fonts on Node 18 & 20)
- `playwright`
- (Optional) `coverage` once threshold reporting is added

Set “Require branches to be up to date before merging” to ensure Matrix + Playwright jobs reflect latest main.

## PDF Testing Modes

A deterministic fast-path for PDF generation exists for Playwright tests, activated via the `pdfTestFast=1` query parameter. It bypasses heavy React-PDF rendering to eliminate flakiness and produce near-instant downloads. This path is automatically guarded to non-production environments (`NODE_ENV !== 'production'`).

See `docs/DEV_NOTES.md` for:

- Rationale and diagnostics (`pdfDiag` steps)
- Failure simulation via `window.__pdfFailOnce`
- Optional slow-path ideas and coverage caveats

When you need to exercise the real rendering pipeline (fonts, layout, size metrics), omit the parameter or set an env var (see upcoming real PDF test spec) to run a full render.
