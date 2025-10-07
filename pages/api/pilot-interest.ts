import type { NextApiRequest, NextApiResponse } from 'next';
import { rateLimit } from '@/lib/rateLimit';
import { getKV } from '@/lib/redis';
import { log } from '@/lib/logger';

function allowOrigin(res: NextApiResponse) {
  const origins = (process.env.ALLOW_ORIGIN || '').split(',').map(x => x.trim()).filter(Boolean);
  const origin = origins[0] || '*';
  res.setHeader('Access-Control-Allow-Origin', origin);
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'content-type');
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  allowOrigin(res);
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const ip = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || req.socket.remoteAddress || 'ip:unknown';
  const key = `pilot:${ip}`;
  const rl = await rateLimit.limit(key);
  if (!rl.success) {
    log('warn', 'rate-limit', { route: 'pilot-interest', ip, remaining: rl.remaining });
    return res.status(429).json({ error: 'Too many requests' });
  }

  try {
    const {
      email,
      name,
      idea,
      source,
      vertical,
      use_case,
      utm_source,
      utm_medium,
      utm_campaign,
      referrer,
      paid_pilot,
      budget_range
    } = (req.body || {}) as Record<string, any>;
    if (!email || typeof email !== 'string' || !email.includes('@')) {
      return res.status(400).json({ error: 'Invalid email' });
    }

    const kv = getKV();
    const dedupeKey = `pilot:interest:${email.toLowerCase()}:${vertical || 'na'}:${use_case || 'na'}`;
    const exists = await kv.get(dedupeKey);
    if (exists) {
      log('info', 'pilot-dedupe', { email, vertical, use_case, source });
      return res.status(200).json({ ok: true, dedupe: true });
    }

    const payload = {
      email: email.toLowerCase(),
      name: name || null,
      idea: idea || null,
      source: source || 'pilot',
      vertical: vertical || null,
      use_case: use_case || null,
      utm_source: utm_source || null,
      utm_medium: utm_medium || null,
      utm_campaign: utm_campaign || null,
      referrer: referrer || req.headers.referer || null,
      paid_pilot: paid_pilot === true,
      budget_range: budget_range || null,
      ts: Date.now(),
    };
    await kv.set(dedupeKey, payload, { ex: 60 * 60 * 24 * 30 }); // 30 days TTL
    log('info', 'pilot-insert-ok', payload);

    // maintain a rolling index for aggregation
    const idxKey = `pilot:index:${vertical || 'na'}:${use_case || 'na'}`;
    const existing = (await kv.get<string[]>(idxKey)) || [];
    existing.unshift(dedupeKey);
    // keep last 500 entries to bound memory
    await kv.set(idxKey, existing.slice(0, 500), { ex: 60 * 60 * 24 * 90 });

    return res.status(201).json({ ok: true });
  } catch (e: any) {
    log('error', 'pilot-insert-fail', { error: e?.message || String(e) });
    return res.status(500).json({ error: 'Server error' });
  }
}
