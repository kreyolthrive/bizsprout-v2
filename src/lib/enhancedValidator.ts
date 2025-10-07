import {
  extractIdeaDetails,
  inferBusinessType,
  resolveMarketCategory,
  getMarketIntelligence,
  type BusinessType,
  type MarketIntelligenceEntry,
} from "./validationFramework";
import { FinancialValidator } from "./financialValidator";
import { calculateRealisticFinancials } from "./financialReality";
import { PivotRecommendationEngine } from "./validationFramework";
import { ComprehensiveReportGenerator } from "./comprehensiveReportGenerator";
import type { UnitEconomicsResult } from "./financialValidator";

const PROJECT_MANAGEMENT_KEY = "project_management_saas" as const;

function parsePrice(text?: string | null): number | null {
  if (!text) return null;
  const match = String(text).replace(/,/g, "").match(/\$?\s*(\d+(?:\.\d+)?)/);
  if (!match) return null;
  const value = parseFloat(match[1]);
  return Number.isFinite(value) ? value : null;
}

function parsePercent(text?: string | null): number | null {
  if (!text) return null;
  const match = String(text).match(/(\d+(?:\.\d+)?)/);
  if (!match) return null;
  const value = parseFloat(match[1]) / 100;
  return Number.isFinite(value) ? value : null;
}

function deriveCostModelKey(businessType: BusinessType, ideaText: string): typeof PROJECT_MANAGEMENT_KEY | null {
  const lower = ideaText.toLowerCase();
  if (businessType === "saas" && /project|task|kanban|workflow/.test(lower)) {
    return PROJECT_MANAGEMENT_KEY;
  }
  return null;
}

function extractBusinessDetails(ideaText: string) {
  const details = extractIdeaDetails(ideaText);
  const businessType = details.businessType ?? inferBusinessType(ideaText);
  const pricing = parsePrice(details.pricing) ?? parsePrice(ideaText);
  const costKey = deriveCostModelKey(businessType, ideaText);

  return {
    businessType,
    pricing,
    costKey,
  } as const;
}

function classifyBusinessCategory(ideaText: string, businessType: BusinessType) {
  return resolveMarketCategory(businessType, null, "general") || ideaText;
}

type EvidenceScore = {
  score: number;
  reasoning: string;
  evidence: string[];
  confidence: number;
};

class EvidenceBasedScoring {
  static scoreDemandWithEvidence(idea: string, marketIntel: MarketIntelligenceEntry | null): EvidenceScore {
    let score = 5;
    const evidence: string[] = [];
    const negatives: string[] = [];
    const positives: string[] = [];

    const growth = marketIntel?.cagr ? parseFloat(marketIntel.cagr) : null;
    if (growth != null && Number.isFinite(growth)) {
      if (growth >= 20) {
        score += 2;
        positives.push(`Hypergrowth (${marketIntel?.cagr})`);
      } else if (growth >= 10) {
        score += 1;
        positives.push(`Solid growth (${marketIntel?.cagr})`);
      } else if (growth < 5) {
        score -= 1;
        negatives.push(`Low growth (${marketIntel?.cagr})`);
      }
    }

    if (marketIntel?.marketSize) {
      positives.push(`Market size ${marketIntel.marketSize}`);
    }

    if (typeof marketIntel?.saturation === "number") {
      const players = marketIntel?.majorPlayers?.length ?? 0;
      if (marketIntel.saturation > 90) {
        score -= 3;
        negatives.push(`${marketIntel.saturation}% saturation with ${players || "multiple"} incumbents`);
      } else if (marketIntel.saturation > 75) {
        score -= 2;
        negatives.push(`High saturation (${marketIntel.saturation}%)`);
      } else if (marketIntel.saturation < 50) {
        score += 1;
        positives.push(`Whitespace at ${marketIntel.saturation}% saturation`);
      }
    }

    if (marketIntel?.freeAlternatives?.length) {
      score -= 1;
      negatives.push(`Free alternatives (${marketIntel.freeAlternatives.join(", ")})`);
    }

    evidence.push(...positives, ...negatives);
    const reasoning = negatives.length
      ? `Demand constrained by ${negatives.join(" and ")}`
      : positives.length
      ? `Demand supported by ${positives.join(" and ")}`
      : "Limited demand signals available";

    const confidenceSignals = [marketIntel?.cagr, marketIntel?.marketSize, marketIntel?.saturation]
      .filter((value) => value != null)
      .length + (marketIntel?.freeAlternatives?.length ? 1 : 0);

    const confidence = Math.min(95, 60 + confidenceSignals * 6);

    return {
      score: EvidenceBasedScoring.clamp(score),
      reasoning,
      evidence,
      confidence,
    };
  }

  static scoreMoatWithEvidence(idea: string, marketIntel: MarketIntelligenceEntry | null): EvidenceScore {
    let score = 4;
    const evidence: string[] = [];
    const positives: string[] = [];
    const negatives: string[] = [];
    const lower = idea.toLowerCase();

    const differentiators = [
      { keyword: "vertical", label: "vertical specialization", weight: 2 },
      { keyword: "industry", label: "industry expertise", weight: 2 },
      { keyword: "compliance", label: "compliance moat", weight: 1 },
      { keyword: "integration", label: "integration ecosystem", weight: 1 },
      { keyword: "workflow", label: "workflow automation depth", weight: 1 },
      { keyword: "ai", label: "AI automation", weight: 1 },
      { keyword: "data", label: "proprietary data", weight: 1 },
    ] as const;

    let differentiatorCount = 0;
    differentiators.forEach(({ keyword, label, weight }) => {
      if (lower.includes(keyword)) {
        score += weight;
        differentiatorCount += 1;
        positives.push(label);
      }
    });

    if (marketIntel?.barriers?.length) {
      score += 1;
      positives.push(`Barriers: ${marketIntel.barriers.join(", ")}`);
    }

    const genericSignals = ["tasks", "deadlines", "collaboration", "team", "kanban"];
    const genericCount = genericSignals.filter((signal) => lower.includes(signal)).length;
    if (genericCount >= 3 && differentiatorCount === 0) {
      score -= 2;
      negatives.push("Generic feature set with limited differentiation");
    }

    const incumbents = marketIntel?.majorPlayers?.length ?? 0;
    if (incumbents >= 4) {
      score -= 1;
      negatives.push(`${incumbents} scaled incumbents with network effects`);
    }

    evidence.push(...positives, ...negatives);
    const reasoning = negatives.length
      ? negatives.join(". ")
      : positives.length
      ? `Differentiation via ${positives.join(", ")}`
      : "Limited defensibility signals";

    const confidence = Math.min(95, 58 + (positives.length + negatives.length) * 5);

    return {
      score: EvidenceBasedScoring.clamp(score),
      reasoning,
      evidence,
      confidence,
    };
  }

  static scoreEconomicsWithEvidence(economics: UnitEconomicsResult | null | undefined): EvidenceScore {
    if (!economics) {
      return {
        score: 5,
        reasoning: "No unit economics provided; defaulting to neutral score.",
        evidence: [],
        confidence: 40,
      };
    }

    let score = 5;
    const evidence: string[] = [];
    const negatives: string[] = [];
    const positives: string[] = [];

    if (Number.isFinite(economics.paybackMonths)) {
      evidence.push(`Payback: ${economics.paybackMonths} months`);
      if (economics.paybackMonths > 24) {
        score -= 3;
        negatives.push("CAC payback exceeds 24 months");
      } else if (economics.paybackMonths <= 12) {
        score += 1;
        positives.push("Payback under 12 months");
      }
    }

    if (Number.isFinite(economics.ltvCacRatio)) {
      evidence.push(`LTV:CAC ${economics.ltvCacRatio}:1`);
      if (economics.ltvCacRatio < 3) {
        score -= 2;
        negatives.push("LTV:CAC below 3:1 benchmark");
      } else if (economics.ltvCacRatio >= 4) {
        score += 1;
        positives.push("LTV:CAC above 4:1");
      }
    }

    evidence.push(`Monthly revenue assumption $${economics.monthlyRevenue}`);
    if (economics.warnings.length) {
      negatives.push(economics.warnings[0]);
    }

    const reasoning = negatives.length
      ? negatives.join(". ")
      : positives.length
      ? positives.join(" and ")
      : "Unit economics within acceptable bounds";

    const confidence = Math.min(95, 60 + evidence.length * 5);

    return {
      score: EvidenceBasedScoring.clamp(score),
      reasoning,
      evidence,
      confidence,
    };
  }

  static scoreDistributionWithEvidence(idea: string, marketIntel: MarketIntelligenceEntry | null): EvidenceScore {
    let score = 5;
    const positives: string[] = [];
    const negatives: string[] = [];
    const lower = idea.toLowerCase();

    const ownedSignals = ["newsletter", "community", "audience", "followers", "email list", "podcast"];
    if (ownedSignals.some((signal) => lower.includes(signal))) {
      score += 2;
      positives.push("Existing audience assets");
    }

    const organicSignals = ["seo", "content", "blog", "youtube", "tiktok", "ugc"];
    if (organicSignals.some((signal) => lower.includes(signal))) {
      score += 1;
      positives.push("Organic acquisition strategy");
    }

    const partnerSignals = ["integration", "partnership", "affiliate", "reseller", "channel"];
    if (partnerSignals.some((signal) => lower.includes(signal))) {
      score += 1;
      positives.push("Partnership/channel motion");
    }

    if (typeof marketIntel?.saturation === "number" && marketIntel.saturation >= 85) {
      score -= 2;
      negatives.push(`High acquisition costs expected at ${marketIntel.saturation}% saturation`);
    }

    if (marketIntel?.freeAlternatives?.length) {
      score -= 1;
      negatives.push("Free competitors depress paid acquisition");
    }

    const evidence = [...positives, ...negatives];
    const reasoning = negatives.length
      ? negatives.join(". ")
      : positives.length
      ? positives.join(" and ")
      : "Limited distribution signals identified";

    const confidence = Math.min(90, 55 + evidence.length * 5);

    return {
      score: EvidenceBasedScoring.clamp(score),
      reasoning,
      evidence,
      confidence,
    };
  }

  private static clamp(value: number) {
    if (!Number.isFinite(value)) return 1;
    return Math.max(1, Math.min(10, Math.round(value)));
  }
}

function buildFinancialSnapshot(
  businessType: BusinessType,
  ideaText: string,
  marketIntel: MarketIntelligenceEntry | null,
  pricing: number | null,
  costKey: typeof PROJECT_MANAGEMENT_KEY | null
) {
  const saturation = marketIntel?.saturation ?? 70;
  const competitorCount = Array.isArray(marketIntel?.majorPlayers) ? marketIntel.majorPlayers.length : 0;
  const avgCAC = marketIntel?.avgCAC ?? 1200;
  const churnRate = parsePercent((marketIntel as any)?.avgChurn) ?? undefined;

  const costs = costKey
    ? FinancialValidator.calculateRealisticCosts(costKey, saturation, competitorCount)
    : null;

  const economics = FinancialValidator.calculateUnitEconomics(pricing ?? 29, avgCAC, {
    churnRate,
  });

  const category = marketIntel?.category ?? classifyBusinessCategory(ideaText, businessType);

  const realistic = calculateRealisticFinancials(businessType, category, {
    saturation,
    competitorCount,
    majorPlayers: marketIntel?.majorPlayers?.map((player) => ({ name: player.name })),
  }, pricing ?? 29);

  return {
    costs,
    economics,
    realistic,
    warnings: economics.warnings,
  } as const;
}

export async function enhancedValidateBusinessIdea(ideaText: string) {
  try {
    const sanitizedIdea = (ideaText || "").trim();
    if (!sanitizedIdea) {
      throw new Error("Idea description is required");
    }

    const { businessType, pricing, costKey } = extractBusinessDetails(sanitizedIdea);
    const marketIntel =
      getMarketIntelligence(businessType, sanitizedIdea) ??
      getMarketIntelligence(undefined, sanitizedIdea) ?? {
        category: classifyBusinessCategory(sanitizedIdea, businessType),
        saturation: 70,
        reasoning: "Baseline assumptions applied due to limited market data.",
      };

    const financialSnapshot = buildFinancialSnapshot(businessType, sanitizedIdea, marketIntel, pricing, costKey);

    const demandScore = EvidenceBasedScoring.scoreDemandWithEvidence(sanitizedIdea, marketIntel);
    const moatScore = EvidenceBasedScoring.scoreMoatWithEvidence(sanitizedIdea, marketIntel);
    const economicsScore = EvidenceBasedScoring.scoreEconomicsWithEvidence(financialSnapshot.economics);
    const distributionScore = EvidenceBasedScoring.scoreDistributionWithEvidence(sanitizedIdea, marketIntel);

    const dimensionScores = {
      demand: demandScore,
      moat: moatScore,
      economics: economicsScore,
      distribution: distributionScore,
    } as const;

    const overall = Math.round(
      (Object.values(dimensionScores).reduce((sum, entry) => sum + entry.score, 0) / (Object.keys(dimensionScores).length * 10)) * 100
    );

    const pivotSuggestions = PivotRecommendationEngine.generatePivotSuggestions(sanitizedIdea, marketIntel);

    const financialsForReport = {
      costs: financialSnapshot.costs,
      startupCosts: financialSnapshot.realistic?.startupCost,
      unitEconomics: {
        verdict: financialSnapshot.economics.isViable
          ? "Unit economics currently viable"
          : "Unit economics fail viability thresholds",
        benchmark: "Healthy SaaS: <24 month payback, >3:1 LTV:CAC",
        calculations: {
          paybackMonths: financialSnapshot.economics.paybackMonths,
          ltvCacRatio: financialSnapshot.economics.ltvCacRatio,
          monthlyRevenue: financialSnapshot.economics.monthlyRevenue,
        },
        warnings: financialSnapshot.economics.warnings,
      },
      breakeven: financialSnapshot.realistic?.breakeven,
      warnings: financialSnapshot.warnings,
      realisticModel: financialSnapshot.realistic,
      costModel: financialSnapshot.costs,
    };

    const report = ComprehensiveReportGenerator.generateFullReport(
      sanitizedIdea,
      { ...dimensionScores, overall },
      marketIntel,
      financialsForReport,
      pivotSuggestions
    );

    return {
      report,
      scores: { ...dimensionScores, overall },
      marketIntel,
      financials: financialSnapshot,
      pivots: pivotSuggestions,
    } as const;
  } catch (error) {
    console.error("Enhanced validation failed:", error);
    return {
      error: "Validation failed",
      details: error instanceof Error ? error.message : String(error),
    } as const;
  }
}

export const EvidenceScoring = EvidenceBasedScoring;
