# Rate Limiting (Upstash)

By default, the app uses an in-memory sliding window limiter which is not shared across instances. For production on Vercel, enable Upstash-backed limiter.

Set environment variables:

- `USE_UPSTASH_LIMITER=1`
- `UPSTASH_REDIS_REST_URL` (from Upstash dashboard)
- `UPSTASH_REDIS_REST_TOKEN` (from Upstash dashboard)

Optional tuning:
- `RATE_LIMIT` (default 20)
- `RATE_WINDOW_MS` (default 60000)

After setting these, API routes using `rateLimit` will enforce limits consistently across deployments/regions.
