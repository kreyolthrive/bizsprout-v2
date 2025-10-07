import type { NextApiRequest, NextApiResponse } from 'next';
import { getSupabaseAdmin } from '@/lib/db';
import { getKV } from '@/lib/redis';

function allowOrigin(res: NextApiResponse) {
  const origins = (process.env.ALLOW_ORIGIN || '').split(',').map(x => x.trim()).filter(Boolean);
  const origin = origins[0] || '*';
  res.setHeader('Access-Control-Allow-Origin', origin);
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'content-type');
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  allowOrigin(res);
  res.setHeader('Cache-Control', 'no-store');
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const { id } = req.query;
  const idStr = Array.isArray(id) ? id[0] : id;
  if (!idStr || typeof idStr !== 'string') return res.status(400).json({ error: 'Missing id' });

  try {
    // 1) Try KV cache first (fast path)
    try {
      const kv = getKV();
      const cached = await kv.get<Record<string, unknown>>(`validation:result:${idStr}`);
      if (cached) {
        return res.status(200).json(cached);
      }
    } catch {}

    // 2) Fallback to DB if configured
    const supabaseAdmin = getSupabaseAdmin();
    if (!supabaseAdmin) {
      return res.status(404).json({ error: 'Not found' });
    }
    const { data, error } = await supabaseAdmin
      .from('validation_results')
      .select('*')
      .eq('id', idStr)
      .limit(1)
      .maybeSingle();
    if (error) {
      return res.status(500).json({ error: 'Database error' });
    }
    if (!data) return res.status(404).json({ error: 'Not found' });
    return res.status(200).json(data);
  } catch (e: unknown) {
    let msg = 'Unknown error';
    if (typeof e === 'string') msg = e;
    else if (e && typeof e === 'object' && 'message' in e && typeof (e as { message?: unknown }).message === 'string') {
      msg = (e as { message: string }).message;
    } else {
      try { msg = JSON.stringify(e); } catch { msg = String(e); }
    }
    return res.status(500).json({ error: 'Server error', details: msg });
  }
}

export const config = {
  api: {
    externalResolver: false,
  },
};
