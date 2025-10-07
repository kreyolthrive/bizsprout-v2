# Dev Notes

## Fast PDF Test Path (`pdfTestFast=1`)

Purpose:

- Provides a deterministic, low-latency path for Playwright tests that exercise the PDF download flow without invoking the heavy React-PDF rendering pipeline.
- Eliminates flakiness stemming from async font loading, dynamic imports, and variable render times.

How It Works:

- When the query parameter `pdfTestFast=1` is present, `generatePdf()` short-circuits:
  1. Checks for one-shot simulated failure flag (`window.__pdfFailOnce`). If set, it records a failure (sets `pdfError`, `pdfDiag.success = false`) and returns.
  2. Otherwise creates a tiny valid PDF blob (starts with `%PDF` bytes), triggers a synthetic download, updates diagnostics (`pdfDiag.success = true`), and exits.
- Normal diagnostic steps (`pushPdfStep`) still log: `Fast mode engaged`, `Fast blob created`, etc.

Simulating Failure (Tests):

```ts
await page.evaluate(() => { (window as unknown as { __pdfFailOnce?: boolean }).__pdfFailOnce = true; });
// First click will record a failure (Status: fail, error message + Retry button)
// Second click succeeds (flag consumed)
```

Why Not Always Use Fast Mode?

- Fast mode bypasses actual PDF layout & component rendering. It validates user-visible interaction (button states, retry logic, diagnostics) but not document structure.
- Real rendering remains covered implicitly by manual checks or could be addressed later with a snapshot regression strategy if needed.

Recommended NODE_ENV Guard:

- To ensure fast mode can’t accidentally be used in production URLs, optionally wrap activation:

```ts
const qpFast = process.env.NODE_ENV !== 'production' && new URLSearchParams(window.location.search).get('pdfTestFast');
```

- This guard is NOT yet applied; current behavior accepts the param in any environment. Add if you want stricter prod parity.

Extensibility Ideas:

- Add a second param `pdfTestSlow=1` to simulate a longer render (e.g. artificial 2s delay) for UX loading state verification.
- Emit a structured console log (`[pdf-fast] success|fail`) for easier CI log scraping.
- Add a Jest-style unit test that invokes the fast path behind a small abstraction to bump coverage.

Caveats:

- Coverage on the React-PDF code path may remain lower because tests no longer exercise that branch; consider adding a non-fast smoke test periodically (cron or separate spec) if branch coverage becomes a concern.
- Fast mode uses a minimal 4-byte PDF header; some viewers may warn if file is opened manually. Adequate for test signal.

Summary:
`pdfTestFast` ensures reliable, fast CI feedback while preserving the real implementation for production and future deeper tests.

## Slow PDF Test Mode (`pdfTestSlow=1`)

Purpose:

- Provides a deterministic artificial delay before real PDF rendering to exercise loading spinners, progress indicators, or UX skeletons.
- Complements `pdfTestFast=1` by validating user perception of latency handling.

Behavior:

- When `pdfTestSlow=1` is present (and `pdfTestFast` is NOT active) in a non-production environment, `generatePdf()` waits ~1500ms before importing the React-PDF modules.
- Diagnostic steps include: `Slow mode engaged (artificial delay)` and `Slow mode delay complete`.
- Mode is ignored in production builds to avoid accidental customer-facing latency injection.

Pairing Strategy:

- Use fast path for correctness / retry logic.
- Use slow path selectively (e.g. a single spec or manual check) to verify loading states remain visible long enough.
- Avoid running slow mode across the whole suite to keep CI time minimal.

Edge Cases:

- If both `pdfTestFast=1` and `pdfTestSlow=1` are specified, fast mode takes precedence and slow is skipped.
- Artificial delay does not alter success/failure paths; failure simulation still controlled by `__pdfFailOnce` (fast mode only).

---

## Monitoring & Integrity

### PDF Error Monitoring

Search logs (locally or aggregated) for failures:

```bash
grep -E 'pdf-error' server*.log || true
grep -E 'pdf-success' server*.log | tail -n 10
```

Structured events to add later (if moving to structured logger):

- `pdf_success` with duration & size
- `pdf_failure` with error code / step

### External Font Host Check

Ensure no external font requests post-deployment:

```bash
# While running in production (or preview) environment devtools network:
# Or via logs if access logs available:
grep -E 'fonts.gstatic|use.typekit|fonts.googleapis' access.log || echo 'No external font hosts referenced'
```

### Font Integrity Verification

Record baseline hashes (after fetching fonts):

```bash
pnpm run fonts:integrity -- --record
```

Validate against baseline (CI or local preflight):

```bash
pnpm run fonts:integrity
```

Non-zero exit indicates a drift (new, missing, or changed font binary). Update baseline intentionally by re-running with `--record` after verifying provenance.

---
