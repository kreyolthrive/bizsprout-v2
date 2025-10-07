export type ScoreDimension = "demand" | "urgency" | "moat" | "distribution" | "economics";

export interface MarketContext {
  saturation?: number;
  cacPaybackMonths?: number;
  [key: string]: unknown;
}

export class ScoreManager {
  visualScores: Record<ScoreDimension, number>;
  detailedScores: Record<ScoreDimension, number>;
  overrideFlags: Partial<Record<ScoreDimension, string>>;

  constructor() {
    this.visualScores = {
      demand: 0,
      urgency: 0,
      moat: 0,
      distribution: 0,
      economics: 0,
    };
    this.detailedScores = { ...this.visualScores };
    this.overrideFlags = {};
  }

  calculateFinalScore(
    dimension: ScoreDimension,
    rawScore: number,
    businessType: string | undefined,
    marketContext: MarketContext = {}
  ): number {
    let adjustedScore = Number.isFinite(rawScore) ? rawScore : 0;

    if (typeof marketContext.saturation === "number" && marketContext.saturation > 80) {
      adjustedScore = Math.min(adjustedScore, 3);
      this.overrideFlags[dimension] = `saturation_penalty_${marketContext.saturation}`;
    }

    if (
      dimension === "economics" &&
      typeof marketContext.cacPaybackMonths === "number" &&
      marketContext.cacPaybackMonths > 24
    ) {
      adjustedScore = Math.min(adjustedScore, 2);
      this.overrideFlags[dimension] = "unit_economics_failed";
    }

    if (adjustedScore < 0) adjustedScore = 0;
    if (adjustedScore > 10) adjustedScore = 10;

    this.visualScores[dimension] = adjustedScore;
    this.detailedScores[dimension] = adjustedScore;

    return adjustedScore;
  }
}

export default ScoreManager;
