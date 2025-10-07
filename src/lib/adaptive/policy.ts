// Adaptive policy mapping: from five dimensions to validation frameworks
import type { BusinessModelKey } from '@/lib/adaptiveValidation';

export type PrimaryContext = {
  businessModelType: 'b2b' | 'b2c' | 'marketplace' | 'dtc';
  industry: string; // free-form; use keywords for regulated categories
  revenueModelComplexity: 'simple' | 'tiered' | 'usage' | 'hybrid';
  targetCustomer: 'consumer' | 'prosumer' | 'smb' | 'midmarket' | 'enterprise' | 'two-sided';
  operationalComplexity: 'digital' | 'physical' | 'hybrid';
};

export type ActivatedFramework =
  | 'saas-subscription'
  | 'two-sided-marketplace'
  | 'compliance-heavy'
  | 'dtc-physical-economics'
  | 'general';

export type PolicyDecision = {
  modelKey: BusinessModelKey;
  frameworks: ActivatedFramework[];
  notes?: string[];
};

export function decidePolicy(ctx: PrimaryContext): PolicyDecision {
  const notes: string[] = [];
  const frameworks: ActivatedFramework[] = [];
  let modelKey: BusinessModelKey = 'general';

  // Business model type
  if (ctx.businessModelType === 'marketplace') {
    modelKey = 'services-marketplace';
    frameworks.push('two-sided-marketplace');
    notes.push('marketplace-detected');
  } else if (ctx.businessModelType === 'dtc') {
    modelKey = ctx.operationalComplexity !== 'digital' ? 'physical-subscription' : 'dtc-ecom';
    frameworks.push('dtc-physical-economics');
    notes.push('dtc-detected');
  } else if (ctx.businessModelType === 'b2b') {
    modelKey = 'saas-b2b';
    frameworks.push('saas-subscription');
    notes.push('b2b-saas-detected');
  } else if (ctx.businessModelType === 'b2c') {
    modelKey = 'saas-b2c';
    frameworks.push('saas-subscription');
    notes.push('b2c-saas-detected');
  }

  // Industry/regulatory
  const industry = ctx.industry.toLowerCase();
  if (/(health|medical|pharma|fintech|finance|legal|insurance)/.test(industry)) {
    if (!frameworks.includes('compliance-heavy')) frameworks.push('compliance-heavy');
    if (modelKey === 'general') modelKey = 'regulated-services';
    notes.push('regulated-industry');
  }

  // Target customer two-sided hint
  if (ctx.targetCustomer === 'two-sided' && !frameworks.includes('two-sided-marketplace')) {
    frameworks.push('two-sided-marketplace');
    if (modelKey === 'general') modelKey = 'services-marketplace';
    notes.push('two-sided-customer');
  }

  // Operational complexity implies physical economics attention
  if (ctx.operationalComplexity !== 'digital' && !frameworks.includes('dtc-physical-economics')) {
    frameworks.push('dtc-physical-economics');
  }

  if (frameworks.length === 0) frameworks.push('general');

  return { modelKey, frameworks, notes };
}

export type Criteria = {
  checks: string[];
  kpis?: Record<string, string>;
  timelineHint?: string;
};

export function getValidationCriteria(decision: PolicyDecision): Criteria[] {
  const out: Criteria[] = [];
  for (const f of decision.frameworks) {
    if (f === 'saas-subscription') {
      out.push({
        checks: [
          'Recurring revenue metrics (MRR/ARR), logo/net revenue retention, churn cohort analysis',
          'Integration readiness (SSO/SAML, SCIM, key partner apps)',
          'Security posture (SOC2/ISO27001 or roadmap); data residency controls',
          'Scalability under load: p95 latency within SLO; DR runbooks',
        ],
        kpis: {
          pilot_conversion: '>= 30–50% with executive sponsor',
          nrr: '>= 100% for healthy SMB+; cohort trends improving',
        },
        timelineHint: '6–12 months multi-stakeholder evaluations',
      });
    }
    if (f === 'two-sided-marketplace') {
      out.push({
        checks: [
          'Supply-demand balance and time-to-liquidity in seed markets',
          'Trust and disintermediation controls; repeat transaction rate',
          'Funnel: visitor→lead, signup→first transaction, 7/30-day retention',
        ],
        kpis: {
          cac: '$30–$150 depending on price point and channel',
          v2l: '1–3% typical for B2B-style funnels; adjust for B2C',
          l2o: '10–15% for B2B-style funnels',
        },
        timelineHint: 'Rapid cycles (days→weeks) with local testbeds',
      });
    }
    if (f === 'compliance-heavy') {
      out.push({
        checks: [
          'Regulatory pathway assessment (licensing, filings, oversight)',
          'AML/KYC/Transaction monitoring controls; auditability',
          'Stress scenarios and incident response runbooks',
        ],
        kpis: {
          kyc_pass: '>= 85–95% geo-dependent; low false negatives',
          fraud_loss_bps: '< 30–50 bps (product-dependent)',
          reliability: 'p99 failure rate within SLO; reconciliation ≥ 99.9%',
        },
        timelineHint: 'Staged rollout: sandbox → supervised scale → general',
      });
    }
    if (f === 'dtc-physical-economics') {
      out.push({
        checks: [
          'Unit economics: COGS + shipping + fulfillment; gross margin %',
          'CAC payback months and LTV:CAC ratio; cohort retention',
          'Seasonality and inventory turns; pause/skip features',
        ],
        kpis: {
          gross_margin: 'Target ≥ 40–60% depending on category',
          payback: '<= 12 months preferred; show p50/p90 bands',
          ltv_cac: '>= 3:1 sustainable at scaled CAC',
        },
        timelineHint: 'Fast iteration with box/cohort experiments',
      });
    }
  }
  if (out.length === 0) out.push({ checks: ['General fit/demand/economics gates'], timelineHint: 'Varies' });
  return out;
}
