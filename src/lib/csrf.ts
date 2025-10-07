// src/lib/csrf.ts
// Lightweight CSRF utilities: secure token generation and timing-safe validation.

import crypto from 'crypto';

/**
 * Generate a CSRF token suitable for cookies/headers.
 * Default: 32 random bytes, base64url encoded (URL and cookie safe).
 */
export function generateCsrfToken(byteLen = 32): string {
  return crypto.randomBytes(byteLen).toString('base64url');
}

/**
 * Constant-time string equality using crypto.timingSafeEqual.
 * Returns false if lengths differ to avoid throwing.
 */
export function timingSafeEqualString(a: string, b: string): boolean {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  if (a.length !== b.length) return false;
  try {
    const ab = Buffer.from(a, 'utf8');
    const bb = Buffer.from(b, 'utf8');
    if (ab.length !== bb.length) return false; // buffer length mismatch due to encoding
    return crypto.timingSafeEqual(ab, bb);
  } catch {
    return false;
  }
}

/**
 * Validate a CSRF token against the expected session token.
 * Note: This assumes a double-submit cookie or server-side session stores the expected token.
 */
export function validateCsrfToken(token: string, expectedToken: string): boolean {
  if (!token || !expectedToken) return false;
  return timingSafeEqualString(token, expectedToken);
}

/**
 * Optional: Signed CSRF tokens (HMAC) for stateless verification.
 * Token format: base64url(payload).base64url(sig)
 * payload = JSON.stringify({ ts, nonce })
 */
export function createSignedCsrfToken(secret: string, maxAgeMs = 2 * 60 * 60 * 1000): string {
  const payload = { ts: Date.now(), nonce: generateCsrfToken(16) };
  const data = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const sig = crypto.createHmac('sha256', secret).update(data).digest('base64url');
  return `${data}.${sig}`;
}

export function verifySignedCsrfToken(token: string, secret: string, maxAgeMs = 2 * 60 * 60 * 1000): boolean {
  if (typeof token !== 'string' || !token.includes('.')) return false;
  const [data, sig] = token.split('.', 2);
  if (!data || !sig) return false;
  const expectedSig = crypto.createHmac('sha256', secret).update(data).digest('base64url');
  if (!timingSafeEqualString(sig, expectedSig)) return false;
  try {
    const payload = JSON.parse(Buffer.from(data, 'base64url').toString('utf8')) as { ts: number };
    if (!payload || typeof payload.ts !== 'number') return false;
    if (Date.now() - payload.ts > maxAgeMs) return false; // expired
    return true;
  } catch {
    return false;
  }
}
