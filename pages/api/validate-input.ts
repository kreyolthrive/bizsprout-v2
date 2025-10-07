import type { NextApiResponse } from 'next';
import { withValidation, SanitizedRequest } from '@/lib/middleware/validation.middleware';

function allowOrigin(res: NextApiResponse) {
  const origins = (process.env.ALLOW_ORIGIN || '').split(',').map(x => x.trim()).filter(Boolean);
  res.setHeader('Access-Control-Allow-Origin', origins[0] || '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'content-type');
}

async function handler(req: SanitizedRequest, res: NextApiResponse): Promise<void> {
  allowOrigin(res);
  if (req.method === 'OPTIONS') { res.status(204).end(); return; }
  if (req.method !== 'POST') { res.status(405).json({ error: 'Method not allowed' }); return; }
  if (!String(req.headers['content-type'] || '').toLowerCase().includes('application/json')) {
    res.status(415).json({ error: 'Unsupported Media Type. Use application/json' });
    return;
  }
  // The middleware already validated and attached sanitizedBody
  res.status(200).json({ ok: true, ip: req.clientIp, sanitized: req.sanitizedBody });
  return;
}

export default withValidation(handler);
