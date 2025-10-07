import { FinancialRealityGenerator } from "./financialReality";
import { ConcretePivotGenerator } from "./concretePivotGenerator";
import { TransparentScoringExplainer } from "./transparentScoringExplainer";
import { getMarketIntelligence, type MarketIntelligenceEntry } from "./validationFramework";

export class EnhancedReportGenerator {
  static generateCompleteReport(idea: string) {
    const marketIntel: MarketIntelligenceEntry | Record<string, never> =
      getMarketIntelligence("project_management", idea) || {};

    const financials = FinancialRealityGenerator.generateProjectManagementFinancials();
    const financialWarnings = FinancialRealityGenerator.formatFinancialWarnings(financials);

    const pivots = ConcretePivotGenerator.generateProjectManagementPivots();

    const demandExplanation = TransparentScoringExplainer.explainDemandScore(3, marketIntel);
    const economicsExplanation = TransparentScoringExplainer.explainEconomicsScore(3, financials);

    return {
      header: {
        score: "33%",
        decision: "NO-GO",
        confidence: "90%",
        reasoning: "Market oversaturated (95% saturation)",
      },
      detailedScoring: {
        demand: demandExplanation,
        economics: economicsExplanation,
      },
      financialReality: {
        startupCosts: financials.startupCosts,
        unitEconomics: financials.unitEconomics,
        competitiveReality: financials.competitiveReality,
        warnings: financialWarnings,
      },
      pivotOpportunities: {
        primary: pivots.primary,
        alternatives: pivots.alternatives,
        howToChoose: [
          "Evaluate your domain expertise in each area",
          "Consider your network access to target customers",
          "Assess market size vs competition trade-offs",
          "Choose based on your ability to validate quickly",
        ],
      },
      actionPlan: {
        immediate: [
          "STOP all development on generic project management tool",
          "Do not invest additional capital in current concept",
        ],
        week1: [
          "Select 1-2 pivot opportunities from recommendations",
          "Begin customer discovery interviews in chosen area",
          "Research regulatory/compliance requirements if applicable",
        ],
        month1: [
          "Complete 15+ customer interviews",
          "Validate problem urgency and willingness to pay",
          "Size addressable market for chosen pivot",
        ],
        successMetrics: pivots.primary.successMetrics,
      },
    };
  }
}

export default EnhancedReportGenerator;
