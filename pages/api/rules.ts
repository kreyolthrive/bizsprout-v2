// pages/api/rules.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { rateLimit } from '@/lib/rateLimit';
import { log } from '@/lib/logger';
import { InMemoryRuleEngine } from '@/lib/adaptive/runtime';
import type { RuleDefinition } from '@/lib/adaptive/ports';
import { getKV } from '@/lib/redis';

function allowOrigin(res: NextApiResponse) {
  const origins = (process.env.ALLOW_ORIGIN || '').split(',').map(x => x.trim()).filter(Boolean);
  res.setHeader('Access-Control-Allow-Origin', origins[0] || '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'content-type');
}

const kv = getKV();
const RULES_KEY = 'adaptive:rules';
const engine = new InMemoryRuleEngine();
const RULES_HISTORY_KEY = 'adaptive:rules:history';

async function loadRules(): Promise<RuleDefinition[]> {
  const fromKV = await kv.get<RuleDefinition[]>(RULES_KEY);
  if (fromKV && Array.isArray(fromKV)) return fromKV;
  return await engine.list();
}

async function saveRules(rules: RuleDefinition[]) {
  await kv.set(RULES_KEY, rules, { ex: 60 * 60 });
}

async function appendHistory(entry: { when: number; ip: string; rules: RuleDefinition[] }) {
  const list = (await kv.get<Array<{ when: number; ip: string; rules: RuleDefinition[] }>>(RULES_HISTORY_KEY)) || [];
  list.push(entry);
  // keep limited history to control size
  const trimmed = list.slice(-50);
  await kv.set(RULES_HISTORY_KEY, trimmed, { ex: 7 * 24 * 60 * 60 });
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  allowOrigin(res);
  if (req.method === 'OPTIONS') return res.status(204).end();
  const ip = (String(req.headers['x-forwarded-for'] || '').split(',')[0] || req.socket.remoteAddress || 'unknown').toString();

  try {
    const { success, remaining, reset } = await rateLimit.limit(`rules:${ip}`);
    res.setHeader('X-RateLimit-Remaining', String(remaining));
    res.setHeader('X-RateLimit-Reset', String(reset));
    if (!success) {
      const retry = Math.max(1, Math.ceil((reset - Date.now()) / 1000));
      res.setHeader('Retry-After', String(retry));
      return res.status(429).json({ error: 'Too many requests' });
    }
  } catch {}

  if (req.method === 'GET') {
    const rules = await loadRules();
    if (String(req.query.history || '') === '1') {
      const history = (await kv.get<Array<{ when: number; ip: string; rules: RuleDefinition[] }>>(RULES_HISTORY_KEY)) || [];
      return res.status(200).json({ rules, history });
    }
    return res.status(200).json({ rules });
  }

  if (req.method === 'POST') {
    if (!String(req.headers['content-type'] || '').toLowerCase().includes('application/json')) {
      return res.status(415).json({ error: 'Unsupported Media Type. Use application/json' });
    }
    const body = req.body;
    if (!body || !Array.isArray(body.rules)) {
      return res.status(400).json({ error: 'Body must include rules: RuleDefinition[]' });
    }
    // Basic validation
    const rules: RuleDefinition[] = [];
    for (const r of body.rules) {
      if (!r || typeof r.id !== 'string' || typeof r.when !== 'string' || !Array.isArray(r.then)) {
        return res.status(400).json({ error: `Invalid rule shape for id ${(r && r.id) || 'unknown'}` });
      }
      rules.push({ ...r });
    }
    await saveRules(rules);
    await appendHistory({ when: Date.now(), ip, rules });
    log('info', 'rules-upsert', { count: rules.length });
    return res.status(200).json({ ok: true });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
