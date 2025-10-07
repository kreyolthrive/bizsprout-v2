import {
  TransparentScoring,
  extractIdeaDetails,
  inferBusinessType,
  getMarketIntelligence,
  resolveMarketCategory,
  assessMarketSaturationPenalty,
  validateUnitEconomics,
  calculateDecisionRecommendation,
  type Scores,
  type BusinessType,
  type MarketIntelligenceEntry,
} from "./validationFramework";
import { UIRenderer, type ScoreRenderMap } from "./uiRenderer";
import { calculateRealisticFinancials, type RealisticFinancials } from "./financialReality";
import { QualityController, type QualityWarning } from "./qualityController";

const DEFAULT_PRICE_BY_TYPE: Partial<Record<BusinessType, number>> = {
  saas: 29,
  marketplace: 25,
  services: 150,
  service_productization: 200,
  ecom: 40,
  creator: 19,
  health: 75,
  fin: 120,
};

const DEFAULT_CHURN_BY_TYPE: Partial<Record<BusinessType, number>> = {
  saas: 0.07,
  marketplace: 0.12,
  services: 0.1,
  service_productization: 0.08,
  ecom: 0.15,
  creator: 0.2,
  health: 0.1,
  fin: 0.09,
};

const DEFAULT_GROSS_MARGIN_BY_TYPE: Partial<Record<BusinessType, number>> = {
  saas: 0.82,
  marketplace: 0.35,
  services: 0.6,
  service_productization: 0.75,
  ecom: 0.4,
  creator: 0.55,
  health: 0.65,
  fin: 0.7,
};

const DEFAULT_SEATS_BY_TYPE: Partial<Record<BusinessType, number>> = {
  saas: 8,
  fin: 4,
  health: 4,
};

const FAILURE_LABELS: Record<string, string> = {
  market_oversaturated: "Market is oversaturated with entrenched incumbents.",
  unit_economics_payback: "CAC payback exceeds 24 month viability threshold.",
  unit_economics_ltv_cac: "LTV to CAC ratio below sustainable benchmark (3:1).",
  unit_economics_failed: "Unit economics model fails viability checks.",
  no_competitive_advantage: "Moat is weak relative to number of incumbents.",
  low_validation_score: "Overall validation score below minimum confidence threshold.",
};

function parsePrice(text?: string): number | null {
  if (!text) return null;
  const match = text.replace(/,/g, "").match(/\$?\s*(\d+(?:\.\d+)?)/);
  if (!match) return null;
  const value = parseFloat(match[1]);
  return Number.isFinite(value) ? value : null;
}

function derivePricing(ideaText: string, businessType: BusinessType, pricingHint?: string): number {
  const priceFromDetails = parsePrice(pricingHint);
  if (priceFromDetails) return priceFromDetails;

  const matchInIdea = parsePrice(ideaText);
  if (matchInIdea) return matchInIdea;

  return DEFAULT_PRICE_BY_TYPE[businessType] ?? 49;
}

function deriveChurn(businessType: BusinessType): number {
  return DEFAULT_CHURN_BY_TYPE[businessType] ?? 0.1;
}

function ensureMarketIntel(
  businessType: BusinessType,
  ideaText: string,
  intel?: MarketIntelligenceEntry | null
): MarketIntelligenceEntry {
  const category = resolveMarketCategory(businessType, intel, 'general');
  if (intel) {
    return { ...intel, category };
  }
  return {
    category,
    saturation: 60,
    reasoning: 'Limited market data available; using baseline assumptions.',
  };
}

function buildScoreMap(entries: {
  demand: ReturnType<typeof TransparentScoring.scoreDemand>;
  moat: ReturnType<typeof TransparentScoring.scoreMoat>;
  economics: ReturnType<typeof TransparentScoring.scoreEconomics>;
  distribution: ReturnType<typeof TransparentScoring.scoreDistribution>;
}): ScoreRenderMap {
  return {
    demand: {
      score: entries.demand.score,
      reasoning: entries.demand.reasoning,
      evidence: entries.demand.evidence,
      confidence: entries.demand.confidence,
    },
    moat: {
      score: entries.moat.score,
      reasoning: entries.moat.reasoning,
      evidence: entries.moat.evidence,
      confidence: entries.moat.confidence,
    },
    economics: {
      score: entries.economics.score,
      reasoning: entries.economics.reasoning,
      evidence: entries.economics.evidence,
      confidence: entries.economics.confidence,
    },
    distribution: {
      score: entries.distribution.score,
      reasoning: entries.distribution.reasoning,
      evidence: entries.distribution.evidence,
      confidence: entries.distribution.confidence,
    },
  };
}

function toNumericScores(scoreMap: ScoreRenderMap): Scores {
  return Object.entries(scoreMap).reduce<Scores>((acc, [dimension, details]) => {
    acc[dimension] = details.score;
    return acc;
  }, {});
}

function appendFailureWarnings(
  base: QualityWarning[],
  failures?: string[]
): QualityWarning[] {
  if (!failures?.length) return base;
  const appended = [...base];
  failures.forEach((failure) => {
    appended.push({
      type: 'CRITICAL',
      message: FAILURE_LABELS[failure] ?? failure,
    });
  });
  return appended;
}

function buildFinancialSummary(
  realistic: RealisticFinancials | null,
  unitEconomics: ReturnType<typeof validateUnitEconomics>
) {
  return {
    realistic,
    unitEconomics,
  };
}

export async function validateBusinessIdea(ideaText: string) {
  try {
    const trimmedIdea = (ideaText || '').trim();
    if (!trimmedIdea) {
      throw new Error('Idea description is required');
    }

    const ideaDetails = extractIdeaDetails(trimmedIdea);
    const businessType = ideaDetails.businessType ?? inferBusinessType(trimmedIdea);
    const pricing = derivePricing(trimmedIdea, businessType, ideaDetails.pricing);

    const marketIntelRaw = getMarketIntelligence(businessType, trimmedIdea);
    const marketIntel = ensureMarketIntel(businessType, trimmedIdea, marketIntelRaw);
    const category = marketIntel.category;

    const realisticFinancials = calculateRealisticFinancials(
      businessType,
      category,
      marketIntel,
      pricing
    );
    const cacEstimate = realisticFinancials?.cac.bounds.max ?? marketIntel.avgCAC ?? 500;
    const churnRate = deriveChurn(businessType);
    const grossMargin = DEFAULT_GROSS_MARGIN_BY_TYPE[businessType] ?? 0.6;
    const averageSeats = DEFAULT_SEATS_BY_TYPE[businessType] ?? 1;
    const unitEconomics = validateUnitEconomics(pricing, cacEstimate, churnRate, {
      averageSeats,
      grossMargin,
    });

    const scoringEntries = {
      demand: TransparentScoring.scoreDemand(marketIntel),
      moat: TransparentScoring.scoreMoat(trimmedIdea, marketIntel),
      economics: TransparentScoring.scoreEconomics(unitEconomics, marketIntel, pricing, cacEstimate),
      distribution: TransparentScoring.scoreDistribution(trimmedIdea, marketIntel),
    };

    const scoreRenderMap = buildScoreMap(scoringEntries);
    const numericScores = toNumericScores(scoreRenderMap);

    const decision = calculateDecisionRecommendation(
      numericScores,
      assessMarketSaturationPenalty(trimmedIdea),
      unitEconomics,
      marketIntel
    );

    const warnings = QualityController.checkForWarnings(trimmedIdea, numericScores, {
      cacPaybackMonths: unitEconomics.paybackMonths ?? undefined,
      ...unitEconomics,
    });
    const allWarnings = appendFailureWarnings(warnings, decision.critical_failures);

    const renderInput = {
      overallScore: decision.overall_score,
      decision: decision.decision,
      confidence: decision.confidence,
      scores: scoreRenderMap,
      reasoning: decision.reasoning,
      nextSteps: decision.nextSteps,
      warnings: allWarnings,
      financials: buildFinancialSummary(realisticFinancials, unitEconomics),
      marketIntel,
    };

    return UIRenderer.renderValidationResults(renderInput);
  } catch (error) {
    console.error('Validation error:', error);
    return {
      error: 'Unable to complete validation',
      suggestion: 'Please provide more specific business details',
    };
  }
}

export default validateBusinessIdea;
