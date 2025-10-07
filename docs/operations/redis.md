# Redis Configuration (Vercel)

You can use a managed Redis (e.g., Upstash or other) and provide a single `REDIS_URL` connection string.

App behavior:
- If `REDIS_URL` is set, the limiter uses `ioredis` for a fixed-window limit.
- Else if `USE_UPSTASH_LIMITER=1` and Upstash envs are present, it uses Upstash.
- Else it falls back to an in-memory limiter (not suitable for multi-instance production).

Env variables:
- `REDIS_URL` (preferred) — e.g., rediss://user:pass@host:port
- `USE_UPSTASH_LIMITER=1`
- `UPSTASH_REDIS_REST_URL`
- `UPSTASH_REDIS_REST_TOKEN`

Tuning:
- `RATE_LIMIT` (default 20)
- `RATE_WINDOW_MS` (default 60000)
