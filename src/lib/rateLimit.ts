type LimitResult = { success: boolean; remaining: number; reset: number };
interface ILimiter { limit(key: string): Promise<LimitResult>; }

class LocalLimiter implements ILimiter {
  private buckets = new Map<string, { resetAt: number; count: number }>();
  constructor(private capacity: number, private windowMs: number) {}
  async limit(key: string): Promise<LimitResult> {
    const now = Date.now();
    let b = this.buckets.get(key);
    if (!b || now >= b.resetAt) b = { resetAt: now + this.windowMs, count: 0 };
    b.count += 1;
    this.buckets.set(key, b);
    return { success: b.count <= this.capacity, remaining: Math.max(0, this.capacity - b.count), reset: b.resetAt };
  }
}

function makeLimiter(): ILimiter {
  // Upstash-only when env vars are present; otherwise fall back to local
  const cap = Number(process.env.RATE_LIMIT || 20);
  const windowMs = Number(process.env.RATE_WINDOW_MS || 60_000);

  const hasUpstash = !!(process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN);
  if (hasUpstash) {
    try {
      // Avoid static bundler resolution by using eval('require')
      const req = eval('require') as NodeRequire;
      const { Ratelimit } = req("@upstash/ratelimit");
      const { Redis } = req("@upstash/redis");
      const redis = new Redis({ url: process.env.UPSTASH_REDIS_REST_URL, token: process.env.UPSTASH_REDIS_REST_TOKEN });
      const rl = new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(cap, `${windowMs} ms`) });
      const adapter: ILimiter = { async limit(key: string) {
        const r = await rl.limit(key);
        return { success: r.success, remaining: r.remaining, reset: r.reset };
      }};
      return adapter;
    } catch {}
  }
  // Fallback: local
  return new LocalLimiter(cap, windowMs);
}

export const limiter: ILimiter = makeLimiter();
export const rateLimit = limiter;   // keep legacy imports working
export default limiter;
