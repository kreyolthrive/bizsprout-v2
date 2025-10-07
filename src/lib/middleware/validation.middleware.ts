// src/lib/middleware/validation.middleware.ts
// API INPUT VALIDATION & SANITIZATION MIDDLEWARE (adapted for this repo)

import type { NextApiRequest, NextApiResponse } from 'next';
import { rateLimit } from '@/lib/rateLimit';
import crypto from 'crypto';
import { validateIdeaInput } from '@/lib/validation/inputSanitizer';
import { ideaDuplicateLimiter } from '@/lib/middleware/rateLimit';

export interface SanitizedRequest extends NextApiRequest {
  sanitizedBody: {
    ideaText?: string;
    email?: string;
    userId?: string;
  };
  clientIp: string;
  requestId?: string;
}

interface ValidationError { field: string; message: string }

export class ValidationMiddleware {
  static async validate(req: NextApiRequest, res: NextApiResponse, next: () => void) {
    try {
      // 0) Attach a request ID for traceability
      const requestId = crypto.randomUUID();
      (req as SanitizedRequest).requestId = requestId;
      res.setHeader('X-Request-Id', requestId);
      // 1) Extract client IP
      const clientIp = getClientIp(req);
      (req as SanitizedRequest).clientIp = clientIp;

      // 2) Rate limit (uses project's limiter) unless disabled via env for tests/scripts
      if (process.env.DISABLE_RATELIMIT !== '1') {
        try {
          const keyBase = typeof (req.body?.userId) === 'string' && req.body.userId.trim() ? String(req.body.userId) : clientIp;
          const { success, remaining, reset } = await rateLimit.limit(`mw:${keyBase}`);
          res.setHeader('X-RateLimit-Remaining', String(remaining));
          res.setHeader('X-RateLimit-Reset', String(reset));
          if (!success) {
            const retryAfter = Math.max(1, Math.ceil((reset - Date.now()) / 1000));
            res.setHeader('Retry-After', String(retryAfter));
            return res.status(429).json({ success: false, error: 'rate_limit_exceeded' });
          }
        } catch {}
      }

    // 3) Validate and sanitize input
  const errors: ValidationError[] = [];
  const sanitized: { ideaText?: string; email?: string; userId?: string } = {};

      const ideaText = req.body?.ideaText;
      // Only validate ideaText when it is a string; ignore other types so routes without ideaText aren't blocked
      if (typeof ideaText === 'string') {
        const r = validateIdeaInput(ideaText);
        if (!r.isValid) errors.push({ field: 'ideaText', message: r.error || 'Invalid idea text' });
        else sanitized.ideaText = r.sanitized;

        // Duplicate-aware limiter (userId or IP key) — can be disabled for tests via env
        if (process.env.DISABLE_DUPLICATE_LIMITER !== '1') {
          try {
            const userIdKey = typeof req.body?.userId === 'string' ? req.body.userId.trim() : undefined;
            const rl = await ideaDuplicateLimiter.check(userIdKey, clientIp, sanitized.ideaText);
            res.setHeader('X-RateLimit-Remaining', String(rl.remaining ?? ''));
            res.setHeader('X-RateLimit-Reset', String(rl.resetAt ?? ''));
            if (!rl.allowed) {
              if (rl.retryAfter != null) res.setHeader('Retry-After', String(rl.retryAfter));
              return res.status(429).json({ success: false, error: 'rate_limit', message: rl.message || 'Too many requests' });
            }
          } catch {}
        }
      }

      const email = req.body?.email;
      if (email != null) {
        if (typeof email === 'string') {
          // Sanitize/normalize email but do not hard-block here; let the route enforce strictness
          const trimmed = email.trim().toLowerCase();
          sanitized.email = trimmed;
        }
      }

      const userId = req.body?.userId;
      if (typeof userId === 'string') sanitized.userId = sanitizeString(userId, 100);

      if (errors.length) return res.status(400).json({ success: false, error: 'validation_error', errors });

  (req as SanitizedRequest).sanitizedBody = sanitized as { ideaText?: string; email?: string; userId?: string };
      next();
    } catch {
      return res.status(500).json({ success: false, error: 'internal_error' });
    }
  }
}

function sanitizeString(input: string, maxLength: number): string {
  return encodeHtml(input.trim().substring(0, maxLength));
}

function encodeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/\//g, '&#x2F;');
}

function getClientIp(req: NextApiRequest): string {
  const forwarded = req.headers['x-forwarded-for'];
  const realIp = req.headers['x-real-ip'];
  if (typeof forwarded === 'string') return forwarded.split(',')[0].trim();
  if (typeof realIp === 'string') return realIp;
  return req.socket.remoteAddress || '0.0.0.0';
}

// Wrapper for Next.js API routes
export function withValidation(handler: (req: SanitizedRequest, res: NextApiResponse) => Promise<void> | void) {
  return async (req: NextApiRequest, res: NextApiResponse) => {
    await ValidationMiddleware.validate(req, res, async () => {
      await handler(req as SanitizedRequest, res);
    });
  };
}
