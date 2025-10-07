import type { NextApiRequest, NextApiResponse } from 'next';
import { analyzePivotOpportunities, type PivotAnalysisRequest } from '@/lib/pivotAnalysis';

function allowOrigin(res: NextApiResponse) {
  const origins = (process.env.ALLOW_ORIGIN || '').split(',').map(x => x.trim()).filter(Boolean);
  res.setHeader('Access-Control-Allow-Origin', origins[0] || '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'content-type');
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  allowOrigin(res);
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  if (!String(req.headers['content-type'] || '').toLowerCase().includes('application/json')) {
    return res.status(415).json({ error: 'Unsupported Media Type. Use application/json' });
  }
  try {
    const body = (req.body || {}) as PivotAnalysisRequest;
    if (!body.originalIdea || typeof body.currentScore !== 'number') {
      return res.status(400).json({ error: 'Invalid request parameters' });
    }
    const analysis = await analyzePivotOpportunities(body);
    return res.status(200).json(analysis);
  } catch (error) {
    console.error('Pivot analysis error:', (error as Error).message);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
