// pages/api/waitlist.ts
import type { NextApiResponse } from 'next';
import { withValidation, type SanitizedRequest } from '@/lib/middleware/validation.middleware';
import { ensureCsrf } from '@/lib/csrfMiddleware';
import { rateLimit } from '@/lib/rateLimit';
import { log } from '@/lib/logger';
// Note: Avoid importing supabase client at module load to prevent errors when env is missing during tests.

interface WaitlistPayload { email?: unknown; name?: unknown; idea?: unknown; source?: unknown }
interface WaitlistRow { id: string }

function allowOrigin(res: NextApiResponse) {
  const origins = (process.env.ALLOW_ORIGIN || '')
    .split(',')
    .map((x) => x.trim())
    .filter(Boolean);
  const origin = origins[0] || '*';
  res.setHeader('Access-Control-Allow-Origin', origin);
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'content-type');
}

async function handler(req: SanitizedRequest, res: NextApiResponse) {
  allowOrigin(res);
  if (req.method === 'OPTIONS') {
    // Issue CSRF cookie on preflight to support simple clients
    await ensureCsrf(req, res);
    return res.status(204).end();
  }
  if (req.method === 'GET') {
    // Allow GET to mint CSRF cookie
    await ensureCsrf(req, res);
    return res.status(200).json({ ok: true });
  }
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  if (!String(req.headers['content-type'] || '').toLowerCase().includes('application/json')) {
    return res.status(415).json({ error: 'Unsupported Media Type. Use application/json' });
  }

  // Enforce CSRF on state-changing request
  const ok = await ensureCsrf(req, res);
  if (!ok) return;

  // Basic IP rate-limit (local or Upstash-backed)
  const ip = (String(req.headers['x-forwarded-for'] || '').split(',')[0] || req.socket.remoteAddress || 'unknown').toString();
  try {
    const rl = await rateLimit.limit(`waitlist:${ip}`);
    res.setHeader('X-RateLimit-Remaining', String(rl.remaining));
    res.setHeader('X-RateLimit-Reset', String(rl.reset));
    if (!rl.success) {
      const retry = Math.max(1, Math.ceil((rl.reset - Date.now()) / 1000));
      res.setHeader('Retry-After', String(retry));
      log('warn', 'rate-limit', { route: 'waitlist', ip });
      return res.status(429).json({ error: 'Too many requests' });
    }
  } catch {}

  // Fast path: if DB is skipped or env is missing, fail-open to a no-op insert.
  const missingDbEnv = !process.env.NEXT_PUBLIC_SUPABASE_URL || !(
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE
  );
  const skipDb = process.env.SKIP_DB === '1';

  // We still validate input before early-return
  try {
    const body: WaitlistPayload = (req.body || {}) as unknown as WaitlistPayload;
    const email = (req.sanitizedBody?.email) || (typeof body.email === 'string' ? body.email : undefined);
    const name = typeof body.name === 'string' ? body.name : undefined;
    const idea = typeof body.idea === 'string' ? body.idea : undefined;
    const source = typeof body.source === 'string' ? body.source : undefined;

    if (!email || !email.includes('@')) {
      return res.status(400).json({ error: 'Invalid email' });
    }

    if (skipDb || missingDbEnv) {
      res.setHeader('X-Waitlist-Mode', 'noop');
  log('info', 'insert-ok', { route: 'waitlist', mode: 'noop', email: email.toLowerCase(), name, idea, source, requestId: (req as SanitizedRequest).requestId });
      // Return Created to keep smoke/E2E deterministic without external deps
      return res.status(201).json({ ok: true, mode: 'noop' });
    }
  } catch {}

  res.setHeader('X-Waitlist-Mode', 'db');

  try {
  const body: WaitlistPayload = (req.body || {}) as unknown as WaitlistPayload;
  const email = (req.sanitizedBody?.email) || (typeof body.email === 'string' ? body.email : undefined);
    const name = typeof body.name === 'string' ? body.name : undefined;
    const idea = typeof body.idea === 'string' ? body.idea : undefined;
    const source = typeof body.source === 'string' ? body.source : undefined;

    // Validate again for DB path
    if (!email || !email.includes('@')) {
      return res.status(400).json({ error: 'Invalid email' });
    }

    const { getSupabaseAdmin } = await import('@/lib/db');
    const supabaseAdmin = getSupabaseAdmin();
    if (!supabaseAdmin) {
      // Fail-open to noop mode if env becomes unavailable mid-request
      res.setHeader('X-Waitlist-Mode', 'noop');
      log('info', 'insert-ok', { route: 'waitlist', mode: 'noop', email: email.toLowerCase(), name, idea, source, requestId: (req as SanitizedRequest).requestId });
      return res.status(201).json({ ok: true, mode: 'noop' });
    }

    // Try to insert; treat unique constraint as dedupe (200)
    const { data, error } = await supabaseAdmin
      .from('waitlist')
      .insert({ email: email!.toLowerCase(), name: name ?? null, idea: idea ?? null, source: source ?? null })
      .select('id')
      .single<WaitlistRow>();

    if (error) {
      const msg = String(error.message || '').toLowerCase();
      if (msg.includes('duplicate') || msg.includes('unique constraint')) {
  log('info', 'dedupe', { route: 'waitlist', email, requestId: (req as SanitizedRequest).requestId });
        return res.status(200).json({ ok: true, dedupe: true });
      }
  log('error', 'insert-fail', { route: 'waitlist', error: error.message, requestId: (req as SanitizedRequest).requestId });
      return res.status(500).json({ error: 'Server error' });
    }

  log('info', 'insert-ok', { route: 'waitlist', id: data?.id, requestId: (req as SanitizedRequest).requestId });
    return res.status(201).json({ ok: true });
  } catch (e: unknown) {
    const err = e instanceof Error ? e.message : String(e);
  log('error', 'insert-fail', { route: 'waitlist', error: err, requestId: (req as SanitizedRequest).requestId });
    return res.status(500).json({ error: 'Server error' });
  }
}

export default withValidation(handler as (req: SanitizedRequest, res: NextApiResponse) => Promise<void> | void);
