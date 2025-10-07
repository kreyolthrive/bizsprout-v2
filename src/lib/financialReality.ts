import { FinancialValidator, type CostBreakdown, type CostModel } from "./financialValidator";

export type FinancialWarnings = Array<{
  severity: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";
  message: string;
  detail?: string;
}>;

type CompetitionTier = "low" | "medium" | "high" | "extreme";

type FinancialModelConfig = {
  startupCostRange: { min: number; max: number };
  factors: Record<string, { multiplier: number; reason: string }>;
  cacByCompetition: Record<CompetitionTier, { min: number; max: number }>;
};

export type RealisticFinancials = {
  startupCost: {
    min: number;
    max: number;
    reasoning?: string;
    multiplier: number;
    breakdown?: CostBreakdown;
  };
  cac: {
    tier: CompetitionTier;
    range: string;
    bounds: { min: number; max: number };
    reasoning: string;
  };
  breakeven: {
    timeMonths: number;
    customerCount: number;
    viabilityWarning: string | null;
  };
  costModel?: CostModel;
};

type MarketSnapshot = {
  saturation?: number | null;
  competitorCount?: number | null;
  majorPlayers?: Array<{ name: string }>;
};

const FINANCIAL_MODELS: Record<string, FinancialModelConfig> = {
  saas: {
    startupCostRange: { min: 50_000, max: 500_000 },
    factors: {
      'project management': { multiplier: 2.0, reason: 'High competition requires superior UX and feature breadth.' },
      'ai platform': { multiplier: 4.0, reason: 'ML infrastructure, GPU costs, and specialised talent drive spend.' },
      marketplace: { multiplier: 3.0, reason: 'Two-sided markets require parallel supply/demand acquisition.' },
    },
    cacByCompetition: {
      low: { min: 50, max: 200 },
      medium: { min: 200, max: 800 },
      high: { min: 800, max: 2_500 },
      extreme: { min: 2_500, max: 5_000 },
    },
  },
};

export function calculateBreakeven(cac: number, monthlyPrice: number) {
  const safePrice = monthlyPrice > 0 ? monthlyPrice : 1;
  const months = Math.ceil(cac / safePrice);
  const customers = Math.ceil(cac / safePrice);
  return {
    timeMonths: months,
    customerCount: customers,
    viabilityWarning: months > 24 ? 'CRITICAL: Payback exceeds 24 months' : null,
  };
}

export function calculateRealisticFinancials(
  businessType: string,
  category: string,
  marketIntel: MarketSnapshot = {},
  pricing = 29
): RealisticFinancials | null {
  const baseModel = FINANCIAL_MODELS[businessType];
  if (!baseModel) return null;

  const normalizedCategory = category.toLowerCase();
  const categoryFactor = baseModel.factors[normalizedCategory];
  const baseMultiplier = categoryFactor?.multiplier ?? 1;
  const saturation = marketIntel.saturation ?? 70;
  const competitorCount =
    marketIntel.competitorCount ?? (Array.isArray(marketIntel.majorPlayers) ? marketIntel.majorPlayers.length : null);

  let costModel: CostModel | null = null;
  if (normalizedCategory.includes('project management')) {
    costModel = FinancialValidator.calculateRealisticCosts(
      'project_management_saas',
      saturation,
      competitorCount ?? 0
    );
  }

  const baseMin = baseModel.startupCostRange.min * baseMultiplier;
  const baseMax = baseModel.startupCostRange.max * baseMultiplier;
  const appliedMin = costModel?.mvp.min ?? baseMin;
  const appliedMax = costModel?.mvp.max ?? baseMax;
  const appliedReasoning = costModel?.mvp.reasoning ?? categoryFactor?.reason;
  const computedMultiplier =
    baseModel.startupCostRange.min > 0 ? appliedMin / baseModel.startupCostRange.min : baseMultiplier;

  const startupCost = {
    min: Math.round(appliedMin),
    max: Math.round(appliedMax),
    reasoning: appliedReasoning,
    multiplier: Number.isFinite(computedMultiplier)
      ? Number(Math.max(1, computedMultiplier).toFixed(2))
      : baseMultiplier,
    breakdown: costModel?.mvp.breakdown,
  };
  let cacTier: CompetitionTier = 'medium';
  if (saturation > 90) cacTier = 'extreme';
  else if (saturation > 80) cacTier = 'high';
  else if (saturation < 50) cacTier = 'low';

  const cacBounds = baseModel.cacByCompetition[cacTier];
  const cac = {
    tier: cacTier,
    range: `$${cacBounds.min}-$${cacBounds.max}`,
    bounds: cacBounds,
    reasoning: `${cacTier} competition market (${Math.round(saturation)}% saturation)`,
  };

  const breakeven = calculateBreakeven(cacBounds.max, pricing);

  return {
    startupCost,
    cac,
    breakeven,
    costModel: costModel ?? undefined,
  };
}

export class FinancialRealityGenerator {
  static generateProjectManagementFinancials() {
    const saturation = 95;
    const assumedCompetitors = 12;
    const pricing = 29;
    const marketCAC = 1_200;
    const econOptions = { churnRate: 0.18, averageSeats: 8, grossMargin: 0.82 } as const;

    const costModel =
      FinancialValidator.calculateRealisticCosts('project_management_saas', saturation, assumedCompetitors) || undefined;

    const realistic = calculateRealisticFinancials(
      'saas',
      'project management',
      { saturation, competitorCount: assumedCompetitors },
      pricing
    );

    const unitEconomicsModel = FinancialValidator.calculateUnitEconomics(pricing, marketCAC, econOptions);
    const unitEconomics = {
      assumptions: {
        pricing,
        marketCAC,
        churnRate: unitEconomicsModel.assumptions.churnRate,
        grossMargin: unitEconomicsModel.assumptions.grossMargin,
        averageSeats: unitEconomicsModel.assumptions.averageSeats,
      },
      calculations: {
        ltv: unitEconomicsModel.ltv,
        paybackMonths: unitEconomicsModel.paybackMonths,
        ltvCacRatio: unitEconomicsModel.ltvCacRatio,
        monthlyRevenue: unitEconomicsModel.monthlyRevenue,
      },
      verdict: unitEconomicsModel.isViable
        ? 'Marginal - improve payback before scaling spend.'
        : `CATASTROPHIC - ${unitEconomicsModel.paybackMonths} month payback, ${unitEconomicsModel.ltvCacRatio}:1 LTV:CAC ratio`,
      benchmark: 'Healthy SaaS: <24 month payback, >3:1 LTV:CAC ratio',
      warnings: unitEconomicsModel.warnings,
    } as const;

    const fallbackBreakdown: CostBreakdown = {
      'Development team (12-18 months)': '$120,000-200,000',
      'Senior designers (UX critical for PM tools)': '$50,000-80,000',
      'DevOps & infrastructure': '$30,000-60,000',
      'Security & compliance': '$25,000-50,000',
      'Legal & IP protection': '$15,000-30,000',
      'Initial marketing & user acquisition': '$60,000-120,000',
    };

    return {
      startupCosts: {
        realistic: {
          min: costModel?.mvp.min ?? 250_000,
          max: costModel?.mvp.max ?? 500_000,
          breakdown: costModel?.mvp.breakdown ?? fallbackBreakdown,
        },
        why_higher:
          costModel?.mvp.reasoning ??
          'Project management is feature-rich category requiring extensive development. Competing with billion-dollar products demands superior UX and comprehensive feature set.',
      },
      realisticModel: realistic || undefined,
      costModel,
      unitEconomics,
      unitEconomicsModel,
      competitiveReality: {
        customerAcquisition: {
          organic: "Extremely difficult - incumbents dominate search results",
          paidAcquisition: "$1,200+ CAC due to competitive bidding on keywords",
          partnerships: "Incumbents have exclusive integration partnerships",
          viral: "Low - project management is utility, not social product",
        },
        retentionChallenges: {
          switchingCosts: "High for users, but low for new prospects",
          networkEffects: "Incumbents benefit from team collaboration lock-in",
          featureParity: "Would need 2+ years to match incumbent features",
        },
      },
    } as const;
  }

  static formatFinancialWarnings(financials: ReturnType<typeof FinancialRealityGenerator.generateProjectManagementFinancials>): FinancialWarnings {
    const warnings: FinancialWarnings = [];

    const payback = financials.unitEconomics.calculations.paybackMonths;
    const paybackText = financials.unitEconomics.warnings?.find((message) => /payback/i.test(message));
    if (typeof payback === 'number' && payback > 24) {
      warnings.push({
        severity: "CRITICAL",
        message: "Unit economics make business unviable",
        detail: paybackText ?? `${payback} month CAC payback vs 24 month maximum`,
      });
    }

    const ratio = financials.unitEconomics.calculations.ltvCacRatio;
    const ratioText = financials.unitEconomics.warnings?.find((message) => /ltv.*cac/i.test(message));
    if (typeof ratio === 'number' && ratio < 3) {
      warnings.push({
        severity: "HIGH",
        message: "LTV:CAC ratio below sustainability threshold",
        detail: ratioText ?? `${ratio}:1 LTV:CAC vs 3:1 benchmark`,
      });
    }

    const residualWarnings = (financials.unitEconomics.warnings || []).filter(
      (message) => !/payback/i.test(message) && !/ltv.*cac/i.test(message)
    );
    residualWarnings.forEach((message) => {
      warnings.push({ severity: message.startsWith('CRITICAL') ? "CRITICAL" : "HIGH", message });
    });

    if (financials.startupCosts.realistic.min > 200_000) {
      warnings.push({
        severity: "HIGH",
        message: "Significant capital requirements",
        detail: `$${financials.startupCosts.realistic.min / 1_000}K+ needed for competitive product`,
      });
    }

    const breakevenWarning = financials.realisticModel?.breakeven?.viabilityWarning;
    if (breakevenWarning) {
      warnings.push({
        severity: "CRITICAL",
        message: "Modeled CAC payback exceeds 24-month viability threshold",
        detail: breakevenWarning,
      });
    }

    return warnings;
  }
}

export default FinancialRealityGenerator;
