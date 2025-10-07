// pages/api/health.ts
import type { NextApiRequest, NextApiResponse } from 'next';

function allowOrigin(res: NextApiResponse) {
  const origins = (process.env.ALLOW_ORIGIN || '')
    .split(',')
    .map((x) => x.trim())
    .filter(Boolean);
  const origin = origins[0] || '*';
  res.setHeader('Access-Control-Allow-Origin', origin);
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'content-type');
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  allowOrigin(res);
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  // Prefer explicit env var, fall back to package.json version if available via process.env
  const version = process.env.APP_VERSION || process.env.npm_package_version || '0.0.0';

  return res.status(200).json({ status: 'ok', timestamp: Date.now(), version });
}
