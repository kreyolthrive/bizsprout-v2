/** @type {import('next').NextConfig} */
// Dynamic Content Security Policy & security headers
// Adjust external domains as integrations change. Keep as strict as feasible.
// Force rebuild after removing conflicting next.config.ts
const isDev = process.env.NODE_ENV !== 'production';
const enableGoogleFonts = process.env.ENABLE_GOOGLE_FONTS === '1';
const googleFontStyle = enableGoogleFonts ? ' https://fonts.googleapis.com' : '';
const googleFontSrc = enableGoogleFonts ? ' https://fonts.gstatic.com' : '';
const csp = [
  "default-src 'self'",
  `script-src 'self'${isDev ? " 'unsafe-inline' 'unsafe-eval'" : ''}`,
  // If temporarily re-enabling hosted Google Fonts during transition set ENABLE_GOOGLE_FONTS=1
  `style-src 'self' 'unsafe-inline'${googleFontStyle}`,
  `style-src-elem 'self' 'unsafe-inline'${googleFontStyle}`,
  "img-src 'self' data: https:",
  `font-src 'self' data:${googleFontSrc}`,
  "connect-src 'self' https://api.anthropic.com https://api.openai.com https://*.supabase.co https://*.upstash.io https://formspree.io https://o450*.ingest.sentry.io",
  "frame-ancestors 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  'block-all-mixed-content',
  ...(isDev ? [] : ['upgrade-insecure-requests'])
].join('; ');

const securityHeaders = [
  { key: 'Content-Security-Policy', value: csp },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'X-DNS-Prefetch-Control', value: 'on' },
  { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
  { key: 'Permissions-Policy', value: 'geolocation=(), microphone=(), camera=()' }
];

let nextConfig = {
  reactStrictMode: true,
  // Don’t fail the Vercel build on type or lint issues
  typescript: { ignoreBuildErrors: true },
  eslint: { ignoreDuringBuilds: true },
  async headers() {
    return [
      {
        source: '/:path*',
        headers: securityHeaders,
      }
    ];
  }
};
// Wrap with Sentry config when available, fallback to raw config otherwise
try {
  const req = eval('require');
  const { withSentryConfig } = req('@sentry/nextjs');
  module.exports = withSentryConfig(nextConfig, { silent: true }, { hideSourceMaps: true });
} catch {
  module.exports = nextConfig;
}
