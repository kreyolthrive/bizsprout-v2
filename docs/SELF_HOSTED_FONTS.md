# Self-Hosted Fonts

This project is transitioning from Google Fonts CDN to self-hosted assets for performance, privacy, and CSP tightening.

## Current Strategy

- Local `@font-face` rules live in `public/fonts/fonts.css`.
- External Google Fonts `<link>` remains temporarily for fallback until all font files are populated.
- Once local files exist and are verified, remove the remote `<link>` tag (and any preconnects) and contract CSP (remove Google Fonts domains).

## Required Families & Weights

Inter: 400, 500, 600, 700, 800 (normal)  
General Sans: 500, 600, 700 (normal)

## Obtaining Font Files

Quick path (Inter only):

```bash
pnpm run fonts:fetch
```

This downloads Inter weights (400–800) as woff2 under `public/fonts/inter`. General Sans must still be placed manually (see below).

1. Visit <https://fonts.google.com> (Inter) and the official source for General Sans (distribution site—often under SIL/OFL style license; verify before bundling).
2. Download variable or static TTFs.
3. Convert to WOFF2 (preferred) and WOFF (fallback) if not provided:
   - Use <https://google-webfonts-helper.herokuapp.com> or locally with `woff2_compress`.
4. Place files:

```text
public/fonts/inter/Inter-400.woff2
public/fonts/inter/Inter-400.woff
... (500,600,700,800)
public/fonts/general-sans/GeneralSans-500.woff2
public/fonts/general-sans/GeneralSans-500.woff
... (600,700)
```

## Verifying

1. Run `pnpm dev`.
2. Open DevTools > Network > filter by `Inter-` to confirm 200 responses from local origin.
3. Temporarily block network requests to `fonts.googleapis.com` & `fonts.gstatic.com` (DevTools > Network conditions) — text should retain intended typography.

## Removing External Fallback

- Delete the `<link href="https://fonts.googleapis.com/...">` and any preconnect tags.
- Remove remote font domains from CSP directives.
- Rebuild and redeploy.

## CSP Hardening (Optional Next Phase)

- Replace `'unsafe-inline'` in style directives by adding nonces or hashing critical inline styles.
- Confirm no inline `<style>` blocks require unsafe-inline before removal.

## Performance Tips

- Consider subsetting glyphs if your user base language scope is limited (e.g., latin only) to reduce file size.
- Use `font-display: swap` (already applied) for faster first paint.

## Troubleshooting

| Symptom | Likely Cause | Fix |
|---------|--------------|-----|
| Fallback system font appears | Missing local font file or wrong filename | Verify path & build output |
| MIME warnings in console | Server not serving correct MIME | Ensure Next static server sets application/font-woff2 (usually automatic) |
| CLS shift on load | External font still late / remote | Remove external `<link>`, rely purely on local files (preload critical weights) |

## Preloading Critical Weights (Optional)

Add in `_document.tsx` `<Head>` once external link removed:

```html
<link rel="preload" href="/fonts/inter/Inter-600.woff2" as="font" type="font/woff2" crossOrigin="anonymous" />
<link rel="preload" href="/fonts/inter/Inter-700.woff2" as="font" type="font/woff2" crossOrigin="anonymous" />
```

Adjust to your most used weights.

---

After fully localizing, open a PR to drop external font CSP allowances.

## Manual Integration (Option 1 – Recommended Quick Path)

If the automated fetch script does not download static weight files, do this:

1. Download Inter release zip from <https://github.com/rsms/inter/releases/latest>.
2. Extract these woff2 files (or convert if only variable provided):
   - Inter-Regular.woff2 → rename to Inter-400.woff2
   - Inter-Medium.woff2 → rename to Inter-500.woff2
   - Inter-SemiBold.woff2 → rename to Inter-600.woff2
   - Inter-Bold.woff2 → rename to Inter-700.woff2
   - Inter-ExtraBold.woff2 → rename to Inter-800.woff2
3. Place them in `public/fonts/inter/`.
4. Acquire General Sans (ensure license) and place as:
   - GeneralSans-500.woff2
   - GeneralSans-600.woff2
   - GeneralSans-700.woff2
   in `public/fonts/general-sans/`.
5. Start dev server and verify Network tab loads local `/fonts/...` assets.
6. Remove external Google Fonts `<link>` once all weights present and stable.
7. Tighten CSP (remove Google Fonts domains) and deploy.

Optional: Instead of multiple Inter weights, you can use the variable font and a single `@font-face` with `font-weight: 400 800;` then delete individual weight blocks.
