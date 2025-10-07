import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

// Enforce HTTPS in production behind Vercel proxy by checking x-forwarded-proto
export function middleware(req: NextRequest) {
  // Always construct a response so we can attach headers even in development
  const requestHeaders = new Headers(req.headers);

  // Enforce HTTPS in production behind Vercel proxy by checking x-forwarded-proto
  // Allow tests/local to bypass redirect
  const skipHttps = process.env.DISABLE_HTTPS_REDIRECT === '1';
  const host = req.headers.get('host') || '';
  const isLocalHost = /^(localhost|127\.0\.0\.1)(:\d+)?$/.test(host);
  if (!skipHttps && process.env.NODE_ENV === 'production' && !isLocalHost) {
    const proto = req.headers.get('x-forwarded-proto');
    if (proto && proto !== 'https') {
      const url = req.nextUrl.clone();
      url.protocol = 'https:';
      return NextResponse.redirect(url, 308);
    }
  }

  // Generate a per-request nonce using Web Crypto (Edge-compatible)
  const arr = new Uint8Array(16);
  crypto.getRandomValues(arr);
  let str = '';
  for (let i = 0; i < arr.length; i++) str += String.fromCharCode(arr[i]);
  const nonce = btoa(str);

  // Propagate nonce to the server components/_document via a request header
  requestHeaders.set('x-csp-nonce', nonce);

  const res = NextResponse.next({ request: { headers: requestHeaders } });

  // Build CSP using the generated nonce; keep it tight (no 'unsafe-inline')
  const upstash = (process.env.UPSTASH_REDIS_REST_URL || '').trim();
  const connectExtra = upstash ? ` ${upstash}` : '';
  const isDev = process.env.NODE_ENV !== 'production';
  // Allow inline styles locally/dev to avoid broken DX; keep strict in production unless explicitly overridden
  const allowInlineStyles = process.env.ALLOW_INLINE_STYLES === '1' || process.env.NODE_ENV !== 'production' || isLocalHost;
  const enableGoogleFonts = process.env.ENABLE_GOOGLE_FONTS === '1';
  const gfStyles = enableGoogleFonts ? ' https://fonts.googleapis.com' : '';
  const gfFonts = enableGoogleFonts ? ' https://fonts.gstatic.com' : '';
  const styleSrc = allowInlineStyles ? `style-src 'self' 'unsafe-inline'${gfStyles}` : `style-src 'self'${gfStyles}`;
  const scriptSrc = isDev
    ? `script-src 'self' 'nonce-${nonce}' 'unsafe-eval'`
    : `script-src 'self' 'nonce-${nonce}'`;
  const connectSrc = `connect-src 'self' https://*.supabase.co https://formspree.io https://*.ingest.sentry.io${connectExtra}${isDev ? ' ws: wss:' : ''}`;
  const csp = [
    "default-src 'self'",
    scriptSrc,
    styleSrc,
  "img-src 'self' data: https:",
  `font-src 'self' data:${gfFonts}`,
    connectSrc,
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self' https://formspree.io",
  ].join('; ');

  // Security headers
  res.headers.set('Content-Security-Policy', csp);
  res.headers.set('X-Content-Type-Options', 'nosniff');
  res.headers.set('X-Frame-Options', 'DENY');
  res.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  res.headers.set('Strict-Transport-Security', 'max-age=63072000; includeSubDomains; preload');

  return res;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml).*)'],
};
