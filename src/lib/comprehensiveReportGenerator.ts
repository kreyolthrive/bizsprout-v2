import type { PivotRecommendations, PivotPrimaryRecommendation, PivotAlternative, MarketIntelligenceEntry } from "./validationFramework";
import type { FinancialWarnings, RealisticFinancials } from "./financialReality";

export type DetailedScoreInput = {
  score: number;
  reasoning?: string;
  evidence?: string[] | string;
  confidence?: number;
};

export type ScoreSummaryInput = Record<string, DetailedScoreInput | number> & {
  overall?: number;
};

export type FinancialRealityInput = {
  startupCosts?: unknown;
  unitEconomics?: {
    verdict?: string;
    benchmark?: string;
    calculations?: {
      paybackMonths?: number;
      ltvCacRatio?: number;
      monthlyRevenue?: number;
    };
    warnings?: string[];
  };
  realisticModel?: RealisticFinancials | null;
  costModel?: unknown;
  breakeven?: {
    timeMonths?: number;
    customerCount?: number;
    viabilityWarning?: string | null;
  };
  warnings?: FinancialWarnings | string[];
};

export type PivotSuggestionBundle = {
  primaryRecommendation: {
    type?: string;
    title: string;
    reasoning: string;
    marketSize?: string | null;
    competition?: string | null;
    advantages?: string[];
    nextSteps?: string[];
  } | null;
  alternatives: Array<{
    type?: string;
    title: string;
    reasoning: string;
    marketSize?: string | null;
    competition?: string | null;
    advantages?: string[];
    nextSteps?: string[];
  }>;
  selectionCriteria?: string[];
};

export class ComprehensiveReportGenerator {
  static generateFullReport(
    idea: string,
    scores: ScoreSummaryInput,
    marketIntel: MarketIntelligenceEntry | Record<string, any>,
    financials: FinancialRealityInput,
    pivots: PivotSuggestionBundle | PivotRecommendations | null
  ) {
    const normalizedScores = this.normalizeScores(scores);
    const executiveSummary = {
      decision: this.determineDecision(normalizedScores.overall),
      confidence: this.calculateConfidence(normalizedScores.detailed, marketIntel || {}),
      oneLineSummary: this.generateOneLineSummary(idea, normalizedScores.overall),
      keyFinding: this.generateKeyFinding(marketIntel || {}, financials),
    } as const;

    const detailedScores = normalizedScores.detailedArray;
    const marketIntelligence = this.summarizeMarketIntel(marketIntel || {});
    const financialReality = this.summarizeFinancialReality(financials);
    const pivotOpportunities = this.normalizePivotOpportunities(pivots);
    const recommendedActions = this.generateActionPlan(normalizedScores.overall, pivotOpportunities);

    return {
      executiveSummary,
      detailedScores,
      marketIntelligence,
      financialReality,
      recommendedActions,
      pivotOpportunities,
    } as const;
  }

  private static normalizeScores(scores: ScoreSummaryInput) {
    const overall = typeof scores.overall === "number" ? Math.round(scores.overall) : this.deriveOverall(scores);
    const detailed: Record<string, DetailedScoreInput> = {};
    const detailedArray: Array<{
      dimension: string;
      score: string;
      reasoning: string;
      evidence: string[];
      confidence: string;
    }> = [];

    Object.entries(scores).forEach(([dimension, value]) => {
      if (dimension === "overall") return;
      const result = this.normalizeScoreEntry(dimension, value);
      if (!result) return;
      detailed[dimension] = result;
      detailedArray.push({
        dimension: this.toTitleCase(dimension),
        score: `${Math.round(result.score)}/10`,
        reasoning: result.reasoning ?? "No reasoning supplied.",
        evidence: result.evidence ?? [],
        confidence: `${result.confidence ?? 80}%`,
      });
    });

    return { overall, detailed, detailedArray } as const;
  }

  private static normalizeScoreEntry(_dimension: string, value: DetailedScoreInput | number | unknown) {
    if (typeof value === "number") {
      return { score: value } satisfies DetailedScoreInput;
    }
    if (typeof value === "object" && value && "score" in value) {
      const entry = value as DetailedScoreInput;
      const evidenceArray = Array.isArray(entry.evidence)
        ? entry.evidence
        : typeof entry.evidence === "string"
        ? [entry.evidence]
        : undefined;
      return {
        score: entry.score,
        reasoning: entry.reasoning,
        evidence: evidenceArray,
        confidence: entry.confidence,
      } satisfies DetailedScoreInput;
    }
    return null;
  }

  private static deriveOverall(scores: ScoreSummaryInput) {
    const values = Object.entries(scores)
      .filter(([key]) => key !== "overall")
      .map(([, value]) => (typeof value === "number" ? value : (value as DetailedScoreInput | any)?.score))
      .filter((num): num is number => typeof num === "number" && Number.isFinite(num));
    if (!values.length) return 0;
    const avg = values.reduce((sum, val) => sum + val, 0) / values.length;
    return Math.round((avg / 10) * 100);
  }

  private static determineDecision(overall: number) {
    if (overall <= 0) return "UNKNOWN";
    if (overall < 40) return "NO-GO";
    if (overall > 70) return "PROCEED";
    return "REVIEW";
  }

  static calculateConfidence(
    scores: Record<string, DetailedScoreInput>,
    marketIntel: MarketIntelligenceEntry | Record<string, any>
  ) {
    let confidence = 70;
    const majorPlayers = Array.isArray(marketIntel.majorPlayers) ? marketIntel.majorPlayers.length : 0;
    if (majorPlayers >= 3) confidence += 10;
    if (typeof marketIntel.saturation === "number" && marketIntel.saturation >= 80) confidence += 10;
    const allScoresHighConfidence = Object.values(scores).every((entry) => (entry.confidence ?? 0) >= 80);
    if (allScoresHighConfidence) confidence += 10;
    return Math.min(95, confidence);
  }

  private static generateOneLineSummary(idea: string, overall: number) {
    const sanitizedIdea = (idea || "Unnamed concept").trim();
    if (!overall && !sanitizedIdea) return "Insufficient data to generate summary.";
    const outcome = overall < 40 ? "requires a hard pivot" : overall > 70 ? "ready for focused execution" : "needs tighter validation";
    return `${sanitizedIdea} scores ${overall}/100 overall and ${outcome}.`;
  }

  private static generateKeyFinding(
    marketIntel: MarketIntelligenceEntry | Record<string, any>,
    financials: FinancialRealityInput
  ) {
    const saturation = typeof marketIntel.saturation === "number" ? marketIntel.saturation : null;
    const warning = this.extractTopFinancialWarning(financials);
    if (saturation && saturation >= 90) {
      return `Market saturation at ${saturation}% severely constrains demand; focus on vertical pivots before further spend.`;
    }
    if (warning) return warning;
    if (marketIntel.reasoning) return marketIntel.reasoning;
    return "Limited validation signals available; gather fresh customer and financial evidence.";
  }

  private static extractTopFinancialWarning(financials: FinancialRealityInput) {
    if (!financials) return null;
    const warningList: string[] = [];
    if (Array.isArray(financials.warnings)) {
      financials.warnings.forEach((item) => {
        if (typeof item === "string") warningList.push(item);
        else if (item && typeof item === "object" && "message" in item) {
          const obj = item as { message?: string; detail?: string };
          const detail = obj.detail ? ` (${obj.detail})` : "";
          if (obj.message) warningList.push(`${obj.message}${detail}`);
        }
      });
    }
    if (warningList.length) return warningList[0];
    const unitWarnings = financials.unitEconomics?.warnings;
    if (Array.isArray(unitWarnings) && unitWarnings.length) return unitWarnings[0];
    const breakeven = financials.breakeven?.viabilityWarning ?? financials.realisticModel?.breakeven?.viabilityWarning;
    if (breakeven) return breakeven;
    return null;
  }

  private static summarizeMarketIntel(intel: MarketIntelligenceEntry | Record<string, any>) {
    const competitors = Array.isArray(intel.majorPlayers)
      ? intel.majorPlayers.map((player) => ({
          name: player.name,
          valuation: player.valuation,
          marketShare: player.marketShare,
          advantage: (player as any).advantage || 'Established market presence',
        }))
      : [];

    return {
      overview: {
        size: intel.marketSize ?? null,
        growth: intel.cagr ?? null,
        saturation: typeof intel.saturation === 'number' ? `${intel.saturation}%` : null,
        avgCAC: intel.avgCAC != null ? `$${intel.avgCAC}` : 'Unknown',
      },
      competitors,
      barriers: intel.barriers ?? [],
    } as const;
  }

  private static summarizeFinancialReality(financials: FinancialRealityInput) {
    if (!financials) {
      return {
        startupCosts: null,
        unitEconomics: null,
        breakeven: null,
        warnings: [],
      } as const;
    }

    const startupCosts = (financials as any).startupCosts ?? (financials as any).costs ?? null;
    const unitEconomics = financials.unitEconomics ?? null;
    const breakeven = financials.breakeven ?? financials.realisticModel?.breakeven ?? null;

    const warnings: string[] = [];
    if (Array.isArray(financials.warnings)) {
      financials.warnings.forEach((item) => {
        if (typeof item === "string") warnings.push(item);
        else if (item && typeof item === "object") {
          const obj = item as { message?: string; detail?: string };
          if (obj.message) warnings.push(obj.detail ? `${obj.message} — ${obj.detail}` : obj.message);
        }
      });
    }
    if (!warnings.length && Array.isArray(unitEconomics?.warnings)) warnings.push(...unitEconomics.warnings);
    if (!warnings.length && breakeven?.viabilityWarning) warnings.push(breakeven.viabilityWarning);

    return {
      startupCosts,
      unitEconomics,
      breakeven,
      warnings,
    } as const;
  }

  static generateActionPlan(overallScore: number, pivots: ReturnType<typeof ComprehensiveReportGenerator.normalizePivotOpportunities>) {
    if (overallScore < 40) {
      return {
        immediate: [
          'STOP all development on current idea',
          'Cease additional capital deployment',
          'Redirect effort toward pivot exploration',
        ],
        firstWeek: [
          'Review pivot opportunities in detail',
          'Select 1-2 pivot directions for rapid validation',
          'Schedule expert interviews in shortlisted pivot domains',
        ],
        monthOne: [
          'Complete 15+ discovery interviews across pivot areas',
          'Benchmark incumbent offerings and pricing',
          'Define validation metrics and early adopter criteria',
        ],
        timeline: 'Immediate pivot required',
      } as const;
    }

    if (overallScore > 70) {
      return {
        immediate: [
          'Prioritise high-impact roadmap items tied to validated demand',
          'Allocate budget to channels with proven CAC efficiency',
          'Formalise success metrics and operating cadence',
        ],
        next30Days: [
          'Launch targeted experiments to double down on strongest growth channel',
          'Recruit advisors or hires filling execution gaps',
          'Spin up KPI dashboard tracking activation, retention, and payback',
        ],
        timeline: 'Proceed with focused execution',
      } as const;
    }

    return {
      immediate: [
        'Run additional discovery calls to close evidence gaps',
        'Validate pricing and willingness to pay with real customers',
        'Stress test projections with sensitivity analysis',
      ],
      next30Days: [
        'Prioritise experiments addressing weakest score dimension',
        'Prepare lightweight pivot scenarios if metrics stagnate',
        'Define go/no-go metrics for the next milestone review',
      ],
      timeline: 'Continue validation with guarded investment',
      suggestedPivots: pivots?.alternatives?.slice(0, 2) ?? [],
    } as const;
  }

  private static normalizePivotOpportunities(
    pivots: PivotSuggestionBundle | PivotRecommendations | null
  ) {
    if (!pivots) return null;

    if ('primaryRecommendation' in pivots) {
      return {
        primary: pivots.primaryRecommendation,
        alternatives: pivots.alternatives,
        selectionCriteria: pivots.selectionCriteria ?? [],
      } as const;
    }

    const primary: PivotPrimaryRecommendation | null = pivots.primary ?? null;
    const alternatives: PivotAlternative[] = pivots.alternatives ?? [];

    return {
      primary: primary
        ? {
            type: primary.type,
            title: primary.title,
            reasoning: primary.rationale,
            marketSize: primary.marketSize ?? primary.marketIntel?.size,
            competition: primary.competition ?? primary.marketIntel?.competition,
            advantages: primary.advantages ?? primary.differentiators,
            nextSteps: primary.nextSteps ?? Object.values(primary.validationPlan ?? {}),
          }
        : null,
      alternatives: alternatives.map((alt) => ({
        type: (alt as any).type,
        title: alt.title,
        reasoning: alt.rationale,
        marketSize: alt.marketSize,
        competition: alt.competition,
        advantages: alt.advantages ?? [],
        nextSteps: alt.nextSteps ?? (alt.quickValidation ? [alt.quickValidation] : []),
      })),
      selectionCriteria: pivots.selectionCriteria ?? [],
    } as const;
  }

  private static toTitleCase(value: string) {
    return value
      .split(/[_\s-]+/)
      .filter(Boolean)
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(' ');
  }
}

export default ComprehensiveReportGenerator;
