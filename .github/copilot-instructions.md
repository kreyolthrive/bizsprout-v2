# Copilot Instructions for bizsprout

These instructions guide AI coding agents for rapid productivity in the Bizsprout monorepo.

## 1. Architecture Overview
- Next.js hybrid app:
  - Legacy SSR pages in `pages/` (e.g. `pages/index.tsx`, `pages/api/*`).
  - App Router in `src/app/` (`page.tsx`, `layout.tsx`, `api/*/route.ts`).
- Core domain logic under `src/lib/`:
  - Validation and scoring live in `validationFramework.ts` (rich types inline; no Zod currently used in this repo).
  - Report generators: `comprehensiveReportGenerator.ts`, `enhancedReportGenerator.ts`, `concretePivotGenerator.ts`.
  - Decision engine & validators: `ideaValidator.ts`, `financialValidator.ts`, `enhancedValidator.ts`.
  - Regulatory rules (YAML matrices & RAG templates) in `src/lib/regulatory/`.
- Persistence:
  - Supabase Postgres client in `src/lib/db.ts`; migrations in `db/migrations/`.
  - Upstash Redis for caching & rate limiting (`src/lib/redis.ts`).
- Background processing via BullMQ (`src/lib/queue.ts`) for asynchronous tasks (emails, report builds).
- Frontend components:
  - Shared UI in `components/` & `components/ui/` using Tailwind CSS and `clsx` (e.g., `ScoreCard.tsx`).

Notes on routing locations
- Use `pages/` for current SSR routes and API routes. A legacy `src/pages/` exists; prefer adding new routes under `pages/` to avoid duplication.
- Prefer `src/app/` for new App Router work; keep SSR pages for the landing and existing APIs until migrated.

## 2. Developer Workflows
- Dev server: `pnpm dev` (Next.js defaults to port 3000; set `PORT=3002` if you want 3002 as used by QA scripts).
- Type-check & lint: `pnpm run typecheck`, `pnpm run lint`.
- Build & serve: `pnpm run build && PORT=3002 pnpm start`.
- QA & performance tests:
  - Two-phase QA: `./qa-dual.sh` (`SKIP_DB=1/0`).
  - Utility scripts: `run-test.sh`, `qa-suite.sh`, `test-all.sh`.
  - K6 benchmark:
    ```bash
    export APP_HOST=http://localhost:3002
    k6 run k6-waitlist.js --env HOST="$APP_HOST" --summary-export k6-summary.json
    ```
  - HTTP benchmarks: `k6-waitlist.js`, `hey`, `oha`.
  - Waitlist dedupe test:
    ```bash
    export APP_HOST=http://localhost:3002
    for i in {1..6}; do
      curl -s -o /dev/null -w "%{http_code}\n" \
        -X POST "$APP_HOST/api/waitlist" \
        -H 'content-type: application/json' \
        -d '{"email":"dup@example.com"}'
    done | sort | uniq -c
    # expect one 201 followed by 200s
    ```
  - IP limiter threshold test:
    ```bash
    export APP_HOST=http://localhost:3002
    for i in {1..20}; do
      curl -s -o /dev/null -w "%{http_code}\n" \
        -X POST "$APP_HOST/api/waitlist" \
        -H 'content-type: application/json' \
        -d "{\"email\":\"u+$RANDOM@example.com\"}"
    done | sort | uniq -c
    # expect mostly 201s unless IP limiter threshold is tiny
    ```
  - Log inspection:
    ```bash
    tail -n 200 server-rl.log | egrep '"msg":"(insert-ok|dedupe|rate-)"' || true
    ```
- Tests:
  - Playwright smoke tests in `smoke.spec.ts`; integration outputs under `test-results/`.

Path aliases
- TypeScript path alias is configured in `tsconfig.json` as `@/* -> src/*`.
  - Example: `import { getKV } from '@/lib/redis'`.
  - UI components: `import { Button } from '@/components/ui/button'`.

## 3. Conventions & Patterns
- API routing:
  - SSR routes in `pages/api`; Route Handlers in `src/app/api/*/route.ts`.
  - Use lightweight input checks in handlers. The validation framework (`src/lib/validationFramework.ts`) exposes rich types and helpers; add Zod only if needed.
- Validation & types:
  - Primary types live inside `src/lib/validationFramework.ts`.
- Logging:
  - Structured logging via `src/lib/logger.ts` (use `logger.info()`, `logger.error()`).
- Rate limiting & CORS:
  - Limiter in `src/lib/rateLimit.ts` supports local sliding-window by default and Upstash with `USE_UPSTASH_LIMITER=1`.
  - CORS origins configured via `ALLOW_ORIGIN` (comma-separated, first origin applied).
- Styling:
  - Tailwind CSS config in `postcss.config.mjs` & `tailwind.config.js`.
  - Use `clsx` for conditional classes; avoid inline style props.
- Environment:
  - Secrets in `.env.local`; only `NEXT_PUBLIC_*` exposed to browser.

Environment flags commonly used
- Rate limit toggles:
  - `DISABLE_RATELIMIT=1` to bypass app-level rate limit checks in some scripts.
  - `USE_UPSTASH_LIMITER=1` to enable Upstash-backed limiter in `src/lib/rateLimit.ts`.
  - `RATE_LIMIT` (default 20) and `RATE_WINDOW_MS` (default 60000) configure capacity and window.
- Redis (optional): `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`. If missing, an in-memory KV is used.
- Supabase: `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`.
- CORS: `ALLOW_ORIGIN` as a comma-separated list. First origin is used in responses.

## 4. Integration Points
- Supabase:
  - Anon and service clients in `src/lib/db.ts` for Postgres queries.
- Redis (Upstash): caching & rate limits in `src/lib/redis.ts`.
- Sentry:
  - Configured via `@sentry/nextjs` in `next.config.js` (DSN from env).
- AI services:
  - OpenAI client in `src/lib/ai.ts`.
  - Anthropic SDK (if used) under `src/lib/anthropic.ts`.
- Email & payments:
  - Approved email providers in validation lists inside `validationFramework.ts`.
  - Stripe policy gate rules in `src/lib/regulatory/platformGate.ts`.
- Monitoring & health:
  - DB health checks in `src/lib/dbHealth.ts`.
  - Redis metrics surfaced via structured `logger` calls.

---
Practical code examples

1) API handler skeleton with CORS + rate limit + JSON guard (`pages/api/*.ts`)

```ts
// pages/api/example.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { rateLimit } from '@/lib/rateLimit';
import { log } from '@/lib/logger';

function allowOrigin(res: NextApiResponse) {
  const origins = (process.env.ALLOW_ORIGIN || '').split(',').map(x => x.trim()).filter(Boolean);
  res.setHeader('Access-Control-Allow-Origin', origins[0] || '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'content-type');
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  allowOrigin(res);
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  if (!String(req.headers['content-type'] || '').toLowerCase().includes('application/json')) {
    return res.status(415).json({ error: 'Unsupported Media Type. Use application/json' });
  }

  const ip = (String(req.headers['x-forwarded-for'] || '').split(',')[0] || req.socket.remoteAddress || 'unknown').toString();
  try {
    const { success, remaining, reset } = await rateLimit.limit(`example:${ip}`);
    res.setHeader('X-RateLimit-Remaining', String(remaining));
    res.setHeader('X-RateLimit-Reset', String(reset));
    if (!success) {
      const retry = Math.max(1, Math.ceil((reset - Date.now()) / 1000));
      res.setHeader('Retry-After', String(retry));
      return res.status(429).json({ error: 'Too many requests' });
    }
  } catch {}

  // ... your logic
  log('info', 'example-ok', { ip });
  return res.status(200).json({ ok: true });
}
```

2) Redis KV helper usage (`src/lib/redis.ts`)

```ts
import { getKV } from '@/lib/redis';

const kv = getKV();
await kv.set('key', { value: 1 }, { ex: 60 }); // 60s TTL
const cached = await kv.get<{ value: number }>('key');
```

3) Local limiter vs Upstash-backed limiter (`src/lib/rateLimit.ts`)

```ts
// Local sliding window by default; enable Upstash by setting USE_UPSTASH_LIMITER=1
import { rateLimit } from '@/lib/rateLimit';
const { success } = await rateLimit.limit(`route:${ip}`);
```

4) BullMQ queue usage (`src/lib/queue.ts`)

```ts
import { q, worker, events } from '@/lib/queue';

// Enqueue a job
await q('emails').add('send-welcome', { to: 'user@example.com' });

// Define a worker
worker('emails', async (job) => {
  // send email with job.data
});

// Optional: listen for events
events('emails').on('completed', ({ jobId }) => {
  console.log('email completed', jobId);
});
```

5) Supabase client usage (`src/lib/db.ts`)

```ts
import { supabase, supabaseAdmin } from '@/lib/db';

// anon client
await supabase.from('validation_results').insert({ id: 'abc', status: 'GO' });

// service role (server-side only)
await supabaseAdmin.from('validation_results').delete().eq('id', 'abc');
```

6) Validation Framework — types and helpers (`src/lib/validationFramework.ts`)

```ts
import type { ValidateResponseV2, ScoreEvidence } from '@/lib/validationFramework';
// Example of expected shape returned by /api/validate
const result: ValidateResponseV2 = {
  id: 'xyz',
  status: 'REVIEW',
  value_prop: 'Save time with automated workflows',
  highlights: ['Strong niche fit'],
  risks: ['Unclear pricing'],
  scores: { demand: 72, urgency: 55, moat: 40, economics: 61 },
  target_market: 'Construction PMs',
  scoring_transparency: [
    { dimension: 'demand', score: 7, signals: ['Waitlist 1.2k'], explanation: 'Clear interest', confidence_level: 'MEDIUM' }
  ] as ScoreEvidence[]
};
```

7) Logging pattern (`src/lib/logger.ts`)

```ts
import { log } from '@/lib/logger';
log('info', 'insert-ok', { route: 'waitlist', email });
log('warn', 'rate-limit', { ip, route: 'waitlist' });
```

Styling tip
- Prefer Tailwind utility classes and `clsx` for variants. Avoid inline `style` props unless necessary; factor shared patterns into `components/ui/*`.

Ports and scripts
- Local dev defaults to 3000 (`pnpm dev`). Many QA scripts assume `PORT=3002`; set it explicitly when running `pnpm start`.
