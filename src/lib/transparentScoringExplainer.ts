export type DemandExplanation = {
  score: string;
  category: "high" | "medium" | "low";
  explanation: string;
  positives: string[];
  negatives: string[];
  reasoning: string;
};

export class TransparentScoringExplainer {
  static explainDemandScore(
    score: number,
    marketIntel: {
      marketSize?: string;
      cagr?: string;
      saturation?: number;
      freeAlternatives?: boolean;
    }
  ): DemandExplanation {
    const category = score >= 7 ? "high" : score >= 4 ? "medium" : "low";
    const explanations = {
      high: "Strong market demand validated by multiple signals",
      medium: "Moderate demand with some concerning factors",
      low: "Demand significantly constrained by market conditions",
    } as const;

    const positives: string[] = [];
    const negatives: string[] = [];

    const sizeValue = parseFloat(marketIntel.marketSize ?? "");
    if (!Number.isNaN(sizeValue) && sizeValue > 5) {
      positives.push(`Large $${sizeValue}B market size`);
    }

    const cagrValue = parseFloat(marketIntel.cagr ?? "");
    if (!Number.isNaN(cagrValue) && cagrValue > 10) {
      positives.push(`Healthy ${cagrValue}% market growth`);
    }

    if (typeof marketIntel.saturation === "number" && marketIntel.saturation > 90) {
      negatives.push(`${marketIntel.saturation}% market saturation limits new entrant opportunity`);
    }

    if (marketIntel.freeAlternatives) {
      negatives.push(`Free alternatives reduce willingness to pay`);
    }

    return {
      score: `${score}/10`,
      category,
      explanation: explanations[category],
      positives,
      negatives,
      reasoning: `${negatives.length ? negatives.join(" and ") : "No major saturation concerns"}. ${
        positives.length ? positives.join(" but ") : "Limited evidence of strong demand"
      }`,
    };
  }

  static explainEconomicsScore(
    score: number,
    financials: {
      unitEconomics: {
        verdict: string;
        benchmark: string;
        calculations: {
          paybackMonths: number;
          ltvCacRatio: number;
        };
      };
    }
  ) {
    const {
      unitEconomics: {
        verdict,
        benchmark,
        calculations: { paybackMonths, ltvCacRatio },
      },
    } = financials;

    return {
      score: `${score}/10`,
      reasoning: verdict,
      breakdown: {
        paybackPeriod: `${paybackMonths} months (target: <24)`,
        ltvCacRatio: `${ltvCacRatio}:1 (target: >3:1)`,
        verdict: paybackMonths > 24 ? "UNVIABLE" : "VIABLE",
      },
      benchmark,
    } as const;
  }
}

export default TransparentScoringExplainer;
