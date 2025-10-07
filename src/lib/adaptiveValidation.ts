// src/lib/adaptiveValidation.ts
// Dynamic Business Validation Framework: adaptive scoring + gates per business model
// Lightweight, pure TS, no external deps

export type BusinessModelKey =
  | 'saas-b2b'
  | 'saas-b2c'
  | 'physical-subscription'
  | 'dtc-ecom'
  | 'services-marketplace'
  | 'freelance-marketplace'
  | 'learning-marketplace'
  | 'regulated-services'
  | 'vertical-comms'
  | 'pm-software'
  | 'general';

export type DimensionKey = 'problem' | 'underserved' | 'demand' | 'differentiation' | 'economics' | 'gtm';

export type WeightMatrix = Record<BusinessModelKey, Record<DimensionKey, number>>;

export const DEFAULT_WEIGHTS: WeightMatrix = {
  'saas-b2b':         { problem: 0.22, underserved: 0.12, demand: 0.18, differentiation: 0.18, economics: 0.20, gtm: 0.10 },
  'saas-b2c':         { problem: 0.18, underserved: 0.15, demand: 0.22, differentiation: 0.18, economics: 0.17, gtm: 0.10 },
  'physical-subscription': { problem: 0.18, underserved: 0.15, demand: 0.18, differentiation: 0.12, economics: 0.27, gtm: 0.10 },
  'dtc-ecom':         { problem: 0.15, underserved: 0.15, demand: 0.20, differentiation: 0.15, economics: 0.25, gtm: 0.10 },
  'services-marketplace':  { problem: 0.18, underserved: 0.17, demand: 0.18, differentiation: 0.12, economics: 0.20, gtm: 0.15 },
  'freelance-marketplace': { problem: 0.18, underserved: 0.17, demand: 0.18, differentiation: 0.12, economics: 0.20, gtm: 0.15 },
  'learning-marketplace':  { problem: 0.17, underserved: 0.18, demand: 0.20, differentiation: 0.13, economics: 0.20, gtm: 0.12 },
  'regulated-services': { problem: 0.20, underserved: 0.18, demand: 0.12, differentiation: 0.15, economics: 0.20, gtm: 0.15 },
  'vertical-comms':   { problem: 0.20, underserved: 0.15, demand: 0.17, differentiation: 0.18, economics: 0.18, gtm: 0.12 },
  'pm-software':      { problem: 0.22, underserved: 0.18, demand: 0.12, differentiation: 0.18, economics: 0.20, gtm: 0.10 },
  'general':          { problem: 0.20, underserved: 0.15, demand: 0.20, differentiation: 0.15, economics: 0.20, gtm: 0.10 },
};

export type GateThresholds = {
  // thresholds expect 0..10 inputs; we’ll compare pre-scaled dimension scores
  demandMin10: number;
  economicsMin10: number;
  problemMin10: number;
  // optional, per-model constraints
  saturationCapOverall100?: number; // e.g., 15 for highly saturated categories
};

export const DEFAULT_GATES: Record<BusinessModelKey, GateThresholds> = {
  'saas-b2b': { demandMin10: 2, economicsMin10: 3, problemMin10: 3 },
  'saas-b2c': { demandMin10: 2, economicsMin10: 3, problemMin10: 3 },
  'physical-subscription': { demandMin10: 2, economicsMin10: 3.5, problemMin10: 2.5 },
  'dtc-ecom': { demandMin10: 2, economicsMin10: 3.5, problemMin10: 2.5 },
  'services-marketplace': { demandMin10: 2, economicsMin10: 3, problemMin10: 3, saturationCapOverall100: 15 },
  'freelance-marketplace': { demandMin10: 2, economicsMin10: 3, problemMin10: 3, saturationCapOverall100: 15 },
  'learning-marketplace': { demandMin10: 2, economicsMin10: 3, problemMin10: 3, saturationCapOverall100: 15 },
  'regulated-services': { demandMin10: 2, economicsMin10: 3, problemMin10: 3 },
  'vertical-comms': { demandMin10: 2, economicsMin10: 3, problemMin10: 3 },
  'pm-software': { demandMin10: 2, economicsMin10: 3, problemMin10: 3, saturationCapOverall100: 15 },
  'general': { demandMin10: 2, economicsMin10: 3, problemMin10: 3 },
};

export type AdaptiveInputs = {
  model: BusinessModelKey;
  saturationPct: number; // 0..100
  dimensions10: Record<DimensionKey, number>; // 0..10 each
};

export type AdaptiveOutcome = {
  weights: Record<DimensionKey, number>;
  gates: GateThresholds;
  gateViolations: Partial<Record<DimensionKey, string>>; // reason text if violated
  overall10: number; // weighted sum
  overall100PreCaps: number;
  overall100PostCaps: number;
  appliedCaps: string[]; // labels for UI transparency
};

export function chooseWeights(model: BusinessModelKey, custom?: Partial<Record<DimensionKey, number>>): Record<DimensionKey, number> {
  const base = DEFAULT_WEIGHTS[model] || DEFAULT_WEIGHTS.general;
  if (!custom) return base;
  const merged: Record<DimensionKey, number> = { ...base, ...custom };
  // normalize to sum = 1
  const sum = Object.values(merged).reduce((a, b) => a + b, 0);
  return Object.fromEntries(Object.entries(merged).map(([k, v]) => [k, v / sum])) as Record<DimensionKey, number>;
}

export function evaluateAdaptive(inputs: AdaptiveInputs, customWeights?: Partial<Record<DimensionKey, number>>): AdaptiveOutcome {
  const weights = chooseWeights(inputs.model, customWeights);
  const gates = DEFAULT_GATES[inputs.model] || DEFAULT_GATES.general;

  const { problem, underserved, demand, differentiation, economics, gtm } = inputs.dimensions10;
  const overall10 = problem * weights.problem + underserved * weights.underserved + demand * weights.demand + differentiation * weights.differentiation + economics * weights.economics + gtm * weights.gtm;
  const overall100PreCaps = Math.round(overall10 * 10);

  const gateViolations: Partial<Record<DimensionKey, string>> = {};
  if (demand < gates.demandMin10) gateViolations.demand = `Demand below minimum (${demand} < ${gates.demandMin10})`;
  if (economics < gates.economicsMin10) gateViolations.economics = `Economics below minimum (${economics} < ${gates.economicsMin10})`;
  if (problem < gates.problemMin10) gateViolations.problem = `Problem below minimum (${problem} < ${gates.problemMin10})`;

  const appliedCaps: string[] = [];
  let overall100PostCaps = overall100PreCaps;
  if (typeof gates.saturationCapOverall100 === 'number' && inputs.saturationPct >= 90) {
    appliedCaps.push(`Saturation cap ${gates.saturationCapOverall100}`);
    overall100PostCaps = Math.min(overall100PostCaps, gates.saturationCapOverall100);
  }

  return { weights, gates, gateViolations, overall10: Number(overall10.toFixed(3)), overall100PreCaps, overall100PostCaps, appliedCaps };
}

export function inferModelFromHints(hints: { businessModel?: string; category?: string; flags?: string[] }): BusinessModelKey {
  const bm = (hints.businessModel || '').toLowerCase();
  const cat = (hints.category || '').toLowerCase();
  const flags = hints.flags || [];
  if (bm.includes('physical')) return 'physical-subscription';
  if (cat.includes('learning') || bm.includes('education')) return 'learning-marketplace';
  if (cat.includes('marketplace') || flags.includes('MARKETPLACE_CATEGORY')) return 'services-marketplace';
  if (flags.includes('CUSTOMER_SUPPORT_CATEGORY')) return 'saas-b2b';
  if (flags.includes('PM_CATEGORY')) return 'pm-software';
  return 'general';
}
