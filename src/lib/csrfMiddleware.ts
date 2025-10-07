import type { NextApiRequest, NextApiResponse } from 'next';
import { createSignedCsrfToken, verifySignedCsrfToken, validateCsrfToken } from '@/lib/csrf';

function parseCookies(req: NextApiRequest): Record<string, string> {
  const header = req.headers.cookie || '';
  return header.split(';').reduce<Record<string, string>>((acc, part) => {
    const [k, ...rest] = part.trim().split('=');
    if (!k) return acc;
    acc[k] = decodeURIComponent(rest.join('='));
    return acc;
  }, {});
}

function setCookie(res: NextApiResponse, name: string, value: string, opts: { maxAge?: number } = {}) {
  const isProd = process.env.NODE_ENV === 'production';
  const parts = [
    `${name}=${encodeURIComponent(value)}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
    isProd ? 'Secure' : '',
    opts.maxAge ? `Max-Age=${Math.floor(opts.maxAge / 1000)}` : '',
  ].filter(Boolean);
  res.setHeader('Set-Cookie', parts.join('; '));
}

export async function ensureCsrf(req: NextApiRequest, res: NextApiResponse): Promise<boolean> {
  // Allow OPTIONS for preflight
  if (req.method === 'OPTIONS') return true;

  // Issue token on GET to prime clients (cookie-based double submit)
  if (req.method === 'GET') {
    const secret = process.env.CSRF_SECRET;
    if (secret) {
      const token = createSignedCsrfToken(secret);
      setCookie(res, 'csrf_token', token, { maxAge: 2 * 60 * 60 * 1000 });
      // Expose token via header for browser clients to read and echo back in POST (double-submit)
      // We keep the HttpOnly cookie for server verification.
      res.setHeader('X-CSRF-Issued', '1');
      res.setHeader('X-CSRF-Token', token);
    }
    return true;
  }

  // Enforce only when secret is present (opt-in)
  const secret = process.env.CSRF_SECRET;
  if (!secret) {
    res.setHeader('X-CSRF-Mode', 'disabled');
    return true;
  }

  const cookies = parseCookies(req);
  const headerToken = String(req.headers['x-csrf-token'] || '');
  const cookieToken = String(cookies['csrf_token'] || '');

  // Prefer signed verification and double-submit equality
  const headerOk = headerToken && verifySignedCsrfToken(headerToken, secret);
  const cookieOk = cookieToken && verifySignedCsrfToken(cookieToken, secret);
  const equal = headerToken && cookieToken && validateCsrfToken(headerToken, cookieToken);

  if (headerOk && cookieOk && equal) return true;

  res.status(403).json({ error: 'csrf_required' });
  return false;
}
