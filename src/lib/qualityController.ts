import { assessMarketSaturation } from "./marketSaturation";
import type { UnitEconomicsValidation } from "./unitEconomics";

export type QualityWarning = {
  type: "CRITICAL" | "LEGAL" | "INFO";
  message: string;
  details?: string;
};

export class QualityController {
  static checkForWarnings(
    businessIdea: string,
    scores: Record<string, number> | null,
    financials: { cacPaybackMonths?: number } & Partial<UnitEconomicsValidation>
  ): QualityWarning[] {
    const warnings: QualityWarning[] = [];

    if (typeof financials.cacPaybackMonths === "number" && financials.cacPaybackMonths > 24) {
      warnings.push({
        type: "CRITICAL",
        message: "STOP - Unit economics unviable",
        details: `CAC payback of ${financials.cacPaybackMonths.toFixed(1)} months exceeds viable threshold (24 months).`,
      });
    }

    const marketMatch = assessMarketSaturation(businessIdea);
    if (marketMatch.penalty) {
      warnings.push({
        type: "CRITICAL",
        message: "STOP - Market oversaturated",
        details: `${marketMatch.reasoning}. Consider pivot to underserved niche.`,
      });
    }

    if (this.detectRegulatoryRisk(businessIdea)) {
      warnings.push({
        type: "LEGAL",
        message: "CAUTION - Regulatory compliance required",
        details: "Significant legal/compliance costs and approval processes required.",
      });
    }

    if (scores) {
      const lowDimensions = Object.entries(scores)
        .filter(([, value]) => Number(value) <= 3)
        .map(([dimension]) => dimension);
      if (lowDimensions.length) {
        warnings.push({
          type: "INFO",
          message: "Weak validation signals detected",
          details: `Dimensions requiring attention: ${lowDimensions.join(", ")}.`,
        });
      }
    }

    return warnings;
  }

  static detectRegulatoryRisk(businessIdea: string): boolean {
    const riskKeywords = ["personal data", "financial services", "healthcare", "children", "gambling", "biometric"];
    const lower = (businessIdea || "").toLowerCase();
    return riskKeywords.some((keyword) => lower.includes(keyword));
  }
}

export default QualityController;
