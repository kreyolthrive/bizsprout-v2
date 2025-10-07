// Lightweight Redis client helper with graceful fallback to in-memory Map

type KV = {
  get<T = unknown>(key: string): Promise<T | null>;
  set(key: string, value: unknown, opts?: { ex?: number; px?: number }): Promise<unknown>;
};

class MemoryKV implements KV {
  store = new Map<string, { v: unknown; exp?: number }>();
  async get<T>(key: string): Promise<T | null> {
    const item = this.store.get(key);
    if (!item) return null;
    if (item.exp && Date.now() > item.exp) {
      this.store.delete(key);
      return null;
    }
    return item.v as T;
  }
  async set(key: string, value: unknown, opts?: { ex?: number; px?: number }) {
    const ttlMs = opts?.px ?? (opts?.ex ? opts.ex * 1000 : undefined);
    const exp = ttlMs ? Date.now() + ttlMs : undefined;
    this.store.set(key, { v: value, exp });
    return true;
  }
}

// Persist the memory store across hot reloads by attaching to globalThis
declare global { var __MEM_KV: MemoryKV | undefined }
const memoryKV = (globalThis as any).__MEM_KV ?? new MemoryKV();
(globalThis as any).__MEM_KV = memoryKV;

export function getKV(): KV {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (url && token) {
    try {
      // Avoid static import to keep dependency optional at runtime
      // eslint-disable-next-line no-eval
      const req = eval('require') as NodeRequire;
      const { Redis } = req("@upstash/redis");
      const r = new Redis({ url, token });
      return {
        async get<T>(key: string) {
          const v = await (r as any).get(key);
          return (v as T | null) ?? null;
        },
        async set(key: string, value: unknown, opts?: { ex?: number; px?: number }) {
          if (opts?.px) return r.set(key, value as any, { px: opts.px });
          if (opts?.ex) return r.set(key, value as any, { ex: opts.ex });
          return r.set(key, value as any);
        },
      } as KV;
    } catch {
      // fall through to memory if module not installed
    }
  }
  return memoryKV;
}

