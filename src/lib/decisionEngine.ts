import type { Scores } from "@/types/validation";
import type { UnitEconomicsValidation } from "./unitEconomics";
import {
  calculateDecisionRecommendation,
  type DecisionRecommendation,
  type MarketSaturationPenalty,
  type MarketIntelligenceEntry,
} from "./validationFramework";

export type MarketContext = MarketSaturationPenalty;

export class DecisionEngine {
  static calculateRecommendation(
    scores: Scores,
    marketContext: MarketContext | null,
    unitEconomics: UnitEconomicsValidation,
    marketIntel?: MarketIntelligenceEntry | null
  ): DecisionRecommendation {
    return calculateDecisionRecommendation(scores, marketContext, unitEconomics, marketIntel);
  }
}

export default DecisionEngine;
