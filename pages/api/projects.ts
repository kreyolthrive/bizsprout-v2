import type { NextApiRequest, NextApiResponse } from 'next';

function allowOrigin(res: NextApiResponse) {
  const origins = (process.env.ALLOW_ORIGIN || '').split(',').map(x => x.trim()).filter(Boolean);
  const origin = origins[0] || '*';
  res.setHeader('Access-Control-Allow-Origin', origin);
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'content-type');
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  allowOrigin(res);
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  // Return an empty list for now; replace with real data source when ready
  return res.status(200).json([]);
}
