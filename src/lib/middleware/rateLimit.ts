// src/lib/middleware/rateLimit.ts
// ============================================================================
// Duplicate-aware rate limiting (in-memory). Can be swapped for Redis later.
// ============================================================================

import { logger } from '@/lib/logger';

export interface RateLimitResult {
  allowed: boolean;
  remaining?: number;
  resetAt?: number;
  message?: string;
  retryAfter?: number;
}

interface RateLimitConfig {
  maxRequests: number; // requests per window
  windowMs: number;    // window length
  maxDuplicates: number; // max identical ideaText submissions per window
}

class RateLimiter {
  private store = new Map<string, { count: number; firstRequest: number; recentIdeas: string[] }>();
  private timer: NodeJS.Timeout | null = null;

  constructor(private config: RateLimitConfig = { maxRequests: 10, windowMs: 60_000, maxDuplicates: 2 }) {
    // Clean up expired entries every minute
    this.timer = setInterval(() => this.cleanup(), 60_000).unref?.() ?? null;
  }

  async check(userId: string | undefined, ip: string, ideaText?: string): Promise<RateLimitResult> {
    const key = (userId && userId.trim()) || ip || 'unknown';
    const now = Date.now();

    let bucket = this.store.get(key);
    if (!bucket) {
      bucket = { count: 0, firstRequest: now, recentIdeas: [] };
      this.store.set(key, bucket);
    }

    // Reset if window expired
    if (now - bucket.firstRequest > this.config.windowMs) {
      bucket.count = 0;
      bucket.firstRequest = now;
      bucket.recentIdeas = [];
    }

    // Request count guard
    if (bucket.count >= this.config.maxRequests) {
      const resetAt = bucket.firstRequest + this.config.windowMs;
      const retryAfter = Math.max(1, Math.ceil((resetAt - now) / 1000));
      // Spike logging on hard cap
      logger.warn('rate-limit-exceeded', {
        userKey: key,
        ip,
        count: bucket.count,
        maxRequests: this.config.maxRequests,
        windowMs: this.config.windowMs,
        resetAt,
      });
      return { allowed: false, message: `Rate limit exceeded. Try again in ${retryAfter}s.`, retryAfter, resetAt };
    }

    // Duplicate guard (only if idea provided)
    if (typeof ideaText === 'string' && ideaText.length > 0) {
      const dupCount = bucket.recentIdeas.filter((x) => x === ideaText).length;
      if (dupCount >= this.config.maxDuplicates) {
        // Spike logging on duplicate cap
        logger.warn('duplicate-idea-block', {
          userKey: key,
          ip,
          dupCount,
          maxDuplicates: this.config.maxDuplicates,
          windowMs: this.config.windowMs,
        });
        return {
          allowed: false,
          message: 'Duplicate submission detected. Please wait before resubmitting the same idea.',
          retryAfter: 30,
          resetAt: bucket.firstRequest + this.config.windowMs,
        };
      }
      // Track idea (keep small)
      bucket.recentIdeas.push(ideaText);
      if (bucket.recentIdeas.length > 10) bucket.recentIdeas.shift();
    }

    // Count this request
    bucket.count += 1;
    const resetAt = bucket.firstRequest + this.config.windowMs;
    const remaining = Math.max(0, this.config.maxRequests - bucket.count);
    return { allowed: true, remaining, resetAt };
  }

  reset(key: string) { this.store.delete(key); }

  private cleanup() {
    const now = Date.now();
    for (const [key, bucket] of this.store.entries()) {
      if (now - bucket.firstRequest > this.config.windowMs * 2) this.store.delete(key);
    }
  }
}

export const ideaDuplicateLimiter = new RateLimiter();
