// Sentry server init (no-op if package missing)
try {
  const req = eval('require');
  const Sentry = req('@sentry/nextjs');
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment: process.env.SENTRY_ENVIRONMENT || process.env.NODE_ENV,
    tracesSampleRate: 0.1,
  });
} catch {}
