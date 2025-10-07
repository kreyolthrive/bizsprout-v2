export type Severity = "info" | "warn" | "block";

export type RegulatoryFinding = {
  jurisdiction: 'US' | 'EU' | 'CA' | 'UK' | 'OTHER';
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'BLOCKER';
  statutes: string[];
  issues: string[];
  notes?: string;
  estimated_costs?: Array<{ line_item: string; range_usd: [number, number] }>;
};

export interface RegulatoryGateResult {
  // Legacy/simple fields
  passed?: boolean;
  reasons?: string[];
  severity?: Severity;
  code?: string;
  details?: Record<string, unknown>;

  // Rich result fields used by regulatory gates
  status?: 'PASS' | 'REVIEW' | 'FAIL';
  headline?: string;
  findings?: RegulatoryFinding[];
  recommendation?: 'DO_NOT_PROCEED' | 'PIVOT_TO_COMPLIANT' | 'CONSULT_COUNSEL';
  suggested_pivots?: string[];
}

export type Scores = {
  demand: number;
  moat: number;
  economics: number;
  distribution: number;
};

export interface UnitEconomics {
  cac?: number;
  payback_months?: number;   // auto_stop if > 24
  arpu_monthly?: number;
  gross_margin?: number;     // 0..1
}

export interface Saturation {
  market_saturation_pct?: number; // auto_stop if > 80
  moat_factors?: string[];
}

export interface ValidationExtras {
  monthly_revenue_est?: number;
  industry_cac_default?: number;
  auto_stop?: string; // "PAYBACK_GT_24M" | "SATURATION_GT_80_PCT" | ...
}

export interface ValidateResponse {
  id: string;
  status: "GO" | "REVIEW" | "NO-GO";
  value_prop: string;
  highlights: string[];
  risks: string[];
  scores: Scores;
  target_market: string;
  title?: string;
  created_at?: string;
  unit_economics?: UnitEconomics;
  extras?: ValidationExtras & Saturation;
}
