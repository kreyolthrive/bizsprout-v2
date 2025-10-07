import type { NextApiRequest, NextApiResponse } from 'next';
import { getKV } from '@/lib/redis';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const token = req.headers['x-admin-token'] || req.query.token;
  if (!process.env.ADMIN_METRICS_TOKEN || token !== process.env.ADMIN_METRICS_TOKEN) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const kv = getKV();
  // For simplicity, scan common pilot index keys (healthcare HIPAA use case)
  const keys = [
    'pilot:index:healthcare:hipaa_email_dispatch',
    'pilot:index:na:na',
  ];

  const out: Record<string, any> = {};
  for (const k of keys) {
    const ids = (await kv.get<string[]>(k)) || [];
    const recent: any[] = [];
    for (const id of ids.slice(0, 25)) {
      const v = await kv.get<any>(id);
      if (v) recent.push(v);
    }
    out[k] = {
      count: ids.length,
      recent,
    };
  }

  return res.status(200).json({ ok: true, data: out });
}
