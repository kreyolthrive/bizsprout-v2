// src/lib/adaptiveSimulation.ts
// Minimal Monte Carlo utilities to support dynamic validation under uncertainty.
// These helpers deliberately avoid external deps and keep APIs small and typed.

export type MonteCarloOptions = {
  runs: number; // e.g., 5000
  seed?: number; // optional seed for reproducibility
};

// Simple LCG for deterministic pseudo-randomness when seed provided
function lcg(seed: number) {
  let s = seed >>> 0;
  return () => (s = (s * 1664525 + 1013904223) >>> 0) / 0xffffffff;
}

function rng(seed?: number) {
  return seed != null ? lcg(seed) : Math.random;
}

export type PaybackParams = {
  // Monthly contribution margin: price * grossMargin - variable costs (for SaaS: price * grossMargin)
  meanMonthlyContribution: number; // USD
  sdMonthlyContribution: number;   // USD, stddev
  cac: number;                     // USD customer acquisition cost
  churnRateMonthly: number;        // e.g., 0.06 (6% per month)
  maxMonths?: number;              // cutoff for evaluation (e.g., 24)
};

export type PaybackResult = {
  p50Months: number | null;
  p90Months: number | null; // 90th percentile of payback time (slower scenario)
  probPaybackWithin12: number; // probability payback <= 12 months
};

export function simulatePayback({ runs, seed }: MonteCarloOptions, params: PaybackParams): PaybackResult {
  const rand = rng(seed);
  const horizon = Math.max(1, Math.floor(params.maxMonths ?? 24));
  const results: number[] = [];
  let within12 = 0;

  // Box-Muller transform for normal noise
  function gaussian() {
    let u = 0, v = 0;
    while (u === 0) u = rand();
    while (v === 0) v = rand();
    return Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
  }

  for (let r = 0; r < runs; r += 1) {
    let cum = -Math.max(0, params.cac);
    let month = 0;
    let paidBack = false;
    while (month < horizon) {
      month += 1;
      const churned = rand() < params.churnRateMonthly;
      if (churned) break;
      const contrib = Math.max(0, params.meanMonthlyContribution + params.sdMonthlyContribution * gaussian());
      cum += contrib;
      if (cum >= 0) {
        results.push(month);
        if (month <= 12) within12 += 1;
        paidBack = true;
        break;
      }
    }
    if (!paidBack) {
      results.push(horizon + 1); // encode as "no payback within horizon"
    }
  }

  results.sort((a, b) => a - b);
  const pick = (p: number) => {
    const idx = Math.min(results.length - 1, Math.max(0, Math.floor(p * results.length)));
    return results[idx] === horizon + 1 ? null : results[idx];
  };

  return {
    p50Months: pick(0.5),
    p90Months: pick(0.9),
    probPaybackWithin12: Number((within12 / runs).toFixed(3)),
  };
}

export type LTVCacParams = {
  ltvMean: number; // USD
  ltvSd: number;   // USD
  cacMean: number; // USD
  cacSd: number;   // USD
  capRatio?: number; // optional cap for realism, e.g., 10x
};

export function simulateLTVCAC({ runs, seed }: MonteCarloOptions, p: LTVCacParams) {
  const rand = rng(seed);
  function gaussian() {
    let u = 0, v = 0;
    while (u === 0) u = rand();
    while (v === 0) v = rand();
    return Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
  }
  const ratios: number[] = [];
  const cap = p.capRatio ?? 12;
  for (let i = 0; i < runs; i += 1) {
    const ltv = Math.max(0, p.ltvMean + p.ltvSd * gaussian());
    const cac = Math.max(1, p.cacMean + p.cacSd * gaussian());
    ratios.push(Math.min(cap, ltv / cac));
  }
  ratios.sort((a, b) => a - b);
  const pct = (q: number) => ratios[Math.min(ratios.length - 1, Math.floor(q * ratios.length))];
  return {
    p50: Number(pct(0.5).toFixed(2)),
    p10: Number(pct(0.1).toFixed(2)),
    p90: Number(pct(0.9).toFixed(2)),
  } as const;
}
