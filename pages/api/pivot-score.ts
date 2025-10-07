import type { NextApiRequest, NextApiResponse } from 'next';

type PivotCandidate = string | { label: string };

type PivotScore = {
  label: string;
  overallPercent: number; // 0-100
  scores: { demand: number; moat: number; distribution: number; economics: number }; // 0-10 each
  market?: {
    tamUsd?: number; // absolute USD
    growthRate?: number; // 0-1
    competitionLevel?: number; // 0-10 (higher = less competition in our UI legend)
    cacDifficulty?: number; // 0-10
    notableCompetitors?: string[];
  };
  description?: string;
};

function allowOrigin(res: NextApiResponse) {
  try {
    const origins = (process.env.ALLOW_ORIGIN || '').split(',').map(x => x.trim()).filter(Boolean);
    res.setHeader('Access-Control-Allow-Origin', origins[0] || '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'content-type');
  } catch {}
}

function toLabel(c: PivotCandidate): string {
  return typeof c === 'string' ? c : String(c?.label || '').trim();
}

function clamp(n: number, lo = 0, hi = 10) { return Math.max(lo, Math.min(hi, n)); }

function scoreFor(labelRaw: string): PivotScore {
  const label = String(labelRaw || '').trim();
  const lower = label.toLowerCase();

  // Base priors (balanced)
  let demand = 5.5;
  let moat = 5.5;
  let distribution = 5.5;
  let economics = 5.5;

  // Market snapshot defaults
  let tamUsd: number | undefined;
  let growthRate: number | undefined;
  let competitionLevel: number | undefined; // higher = less competition (UI legend)
  let cacDifficulty: number | undefined; // higher = harder
  const notableCompetitors: string[] = [];
  let description: string | undefined;

  const bump = (dim: 'demand'|'moat'|'distribution'|'economics', delta: number) => {
    if (dim === 'demand') demand = clamp(demand + delta);
    if (dim === 'moat') moat = clamp(moat + delta);
    if (dim === 'distribution') distribution = clamp(distribution + delta);
    if (dim === 'economics') economics = clamp(economics + delta);
  };

  const setMarket = (opts: Partial<NonNullable<PivotScore['market']>>) => {
    tamUsd = opts.tamUsd ?? tamUsd;
    growthRate = opts.growthRate ?? growthRate;
    competitionLevel = opts.competitionLevel ?? competitionLevel;
    cacDifficulty = opts.cacDifficulty ?? cacDifficulty;
    if (Array.isArray(opts.notableCompetitors)) {
      notableCompetitors.push(...opts.notableCompetitors);
    }
  };

  // Keyword heuristics
  if (/(construction|contractor|job site|field service)/.test(lower)) {
    bump('demand', 1.0);
    bump('distribution', 0.6);
    bump('economics', 1.0);
    bump('moat', 0.5);
    setMarket({ tamUsd: 12_000_000_000, growthRate: 0.06, competitionLevel: 7.5, cacDifficulty: 6.5, notableCompetitors: ['Procore', 'Autodesk'] });
    if (lower.includes('field service')) {
      setMarket({ tamUsd: 5_000_000_000, growthRate: 0.08, competitionLevel: 6.0, notableCompetitors: ['ServiceTitan', 'Jobber'] });
    }
  }

  if (/(healthcare|hipaa|clinic|hospital|nurse|ehr|emr|documentation)/.test(lower)) {
    bump('demand', 0.8);
    bump('moat', 1.0);
    bump('distribution', -0.3); // regulated distribution friction
    bump('economics', 0.5);
    setMarket({ tamUsd: 8_000_000_000, growthRate: 0.10, competitionLevel: 6.5, cacDifficulty: 7.5, notableCompetitors: ['Nuance', 'DeepScribe'] });
    description = lower.includes('documentation') ? 'Healthcare documentation automation' : undefined;
  }

  if (/(legal|law|attorney|ediscovery|case management)/.test(lower)) {
    bump('demand', 0.6);
    bump('moat', 0.8);
    bump('economics', 0.6);
    setMarket({ tamUsd: 2_000_000_000, growthRate: 0.06, competitionLevel: 6.5, cacDifficulty: 6.5, notableCompetitors: ['Clio'] });
  }

  if (/(compliance|governance|audit)/.test(lower)) {
    bump('demand', 0.7);
    bump('economics', 1.0);
    bump('moat', 0.4);
    setMarket({ tamUsd: 3_000_000_000, growthRate: 0.07, competitionLevel: 7.0, notableCompetitors: ['Hyperproof', 'VComply'] });
  }

  if (/(vertical\s*crm|industry crm|crm for)/.test(lower)) {
    bump('demand', 0.5);
    bump('moat', 0.4);
    setMarket({ tamUsd: 10_000_000_000, growthRate: 0.07, competitionLevel: 5.5, notableCompetitors: ['Veeva Systems', 'Salesforce'] });
  }

  if (/(website builder|site builder|landing page builder)/.test(lower)) {
    // Crowded, weak economics vs specialized B2B
    bump('demand', -1.2);
    bump('moat', -1.5);
    bump('economics', -1.0);
    setMarket({ tamUsd: 15_000_000_000, growthRate: 0.05, competitionLevel: 2.0, notableCompetitors: ['Wix', 'Squarespace'] });
  }

  const overallPercent = Math.round(((demand + moat + distribution + economics) / 4) * 10);

  return {
    label: description || label,
    overallPercent,
    scores: { demand, moat, distribution, economics },
    market: { tamUsd, growthRate, competitionLevel, cacDifficulty, notableCompetitors },
  };
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  allowOrigin(res);
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  if (!String(req.headers['content-type'] || '').toLowerCase().includes('application/json')) {
    return res.status(415).json({ error: 'Unsupported Media Type. Use application/json' });
  }

  try {
    const body = req.body || {};
    const candidates: PivotCandidate[] = Array.isArray(body?.candidates) ? body.candidates : [];
    const pivots: PivotScore[] = candidates
      .map(toLabel)
      .filter(Boolean)
      .map(scoreFor)
      // Sort best-first
      .sort((a, b) => b.overallPercent - a.overallPercent);

    return res.status(200).json({ pivots });
  } catch {
    // Fail-soft: return empty pivots list to keep UI stable
    return res.status(200).json({ pivots: [] });
  }
}
