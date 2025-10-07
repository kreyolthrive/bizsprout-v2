import type { QualityWarning, ScoreEvidence, MarketIntelligenceEntry } from "./validationFramework";
import type { DecisionRecommendation } from "./validationFramework";

export type ScoreRenderEntry = {
  score: number;
  reasoning: string;
  evidence: string[];
  confidence: number;
};

export type ScoreRenderMap = Record<string, ScoreRenderEntry>;

export type ValidationRenderInput = {
  overallScore: number;
  decision: DecisionRecommendation['decision'];
  confidence: number;
  scores: ScoreRenderMap;
  reasoning: string;
  nextSteps: string[];
  warnings?: Array<QualityWarning | string>;
  financials?: unknown;
  marketIntel?: MarketIntelligenceEntry | null;
};

export type ValidationRenderOutput = {
  header: {
    score: number;
    decision: DecisionRecommendation['decision'];
    riskLevel: string;
    confidence: number;
  };
  scores: Array<{
    name: string;
    score: number;
    reasoning: string;
    evidence: string[];
    confidence: number;
  }>;
  reasoning: {
    primary: string;
    evidence: string[];
    warnings: Array<{ severity: string; message: string; detail?: string }>;
  };
  nextSteps: {
    immediate: string | null;
    followUp: string[];
    timeline: string;
  };
  financials?: unknown;
  marketIntel: ReturnType<typeof formatMarketIntel>;
};

function confidenceValue(value: number | 'HIGH' | 'MEDIUM' | 'LOW'): number {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return Math.max(0, Math.min(100, Math.round(value)));
  }
  switch (value) {
    case 'HIGH':
      return 90;
    case 'MEDIUM':
      return 75;
    case 'LOW':
    default:
      return 60;
  }
}

function uniqueEvidence(values: ScoreRenderMap): string[] {
  const seen = new Set<string>();
  const ordered: string[] = [];
  Object.values(values).forEach((entry) => {
    entry.evidence.forEach((signal) => {
      const trimmed = signal.trim();
      if (trimmed && !seen.has(trimmed)) {
        seen.add(trimmed);
        ordered.push(trimmed);
      }
    });
  });
  return ordered;
}

function normalizeWarnings(warnings?: Array<QualityWarning | string>) {
  if (!warnings?.length) return [] as Array<{ severity: string; message: string; detail?: string }>;
  return warnings.map((warning) => {
    if (typeof warning === 'string') {
      return { severity: 'INFO', message: warning };
    }
    return {
      severity: warning.type,
      message: warning.message,
      detail: warning.details,
    };
  });
}

function formatMarketIntel(intel?: MarketIntelligenceEntry | null) {
  if (!intel) return null;
  const players = intel.majorPlayers?.map((player) => ({
    name: player.name,
    revenue: player.revenue,
    valuation: player.valuation,
    note: player.note,
    asOf: player.asOf,
  }));

  const stats = intel.stats?.map((stat) => ({
    label: stat.label,
    value: stat.value,
    source: stat.source,
  }));

  return {
    category: intel.category,
    saturation: intel.saturation,
    cagr: intel.cagr,
    marketSize: intel.marketSize,
    barriers: intel.barriers,
    reasoning: intel.reasoning,
    freeAlternatives: intel.freeAlternatives,
    majorPlayers: players,
    stats,
    sources: intel.sources,
  };
}

export class UIRenderer {
  static renderValidationResults(results: ValidationRenderInput): ValidationRenderOutput {
    const overallScore = Math.max(0, Math.min(100, Math.round(results.overallScore)));
    const scoreEntries = Object.entries(results.scores).map(([dimension, data]) => ({
      name: formatDimensionName(dimension),
      score: data.score,
      reasoning: data.reasoning,
      evidence: data.evidence,
      confidence: confidenceValue(data.confidence),
    }));

    return {
      header: {
        score: overallScore,
        decision: results.decision,
        riskLevel: this.getRiskLevel(overallScore),
        confidence: confidenceValue(results.confidence),
      },
      scores: scoreEntries,
      reasoning: {
        primary: results.reasoning,
        evidence: uniqueEvidence(results.scores),
        warnings: normalizeWarnings(results.warnings),
      },
      nextSteps: {
        immediate: results.nextSteps[0] ?? null,
        followUp: results.nextSteps.slice(1),
        timeline: this.getRecommendedTimeline(results.decision),
      },
      financials: results.financials,
      marketIntel: formatMarketIntel(results.marketIntel),
    };
  }

  static fromScoreEvidence(
    evidences: ScoreEvidence[]
  ): ScoreRenderMap {
    const map: ScoreRenderMap = {};
    evidences.forEach((entry) => {
      map[entry.dimension] = {
        score: entry.score,
        reasoning: entry.explanation,
        evidence: entry.signals,
        confidence: entry.confidence_level,
      };
    });
    return map;
  }

  static getRiskLevel(score: number) {
    if (score < 30) return 'HIGH RISK';
    if (score < 60) return 'MODERATE RISK';
    return 'LOW RISK';
  }

  static getRecommendedTimeline(decision: DecisionRecommendation['decision']) {
    switch (decision) {
      case 'NO-GO':
        return 'Immediate pivot required';
      case 'PROCEED':
        return '6-8 weeks validation';
      case 'REVIEW':
        return '2-4 weeks deeper analysis';
      default:
        return 'Timeline varies';
    }
  }
}

function formatDimensionName(name: string) {
  return name
    .split('_')
    .map((part) => (part ? part.charAt(0).toUpperCase() + part.slice(1) : part))
    .join(' ');
}

export { formatMarketIntel };
