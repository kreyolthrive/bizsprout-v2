import type { Scores } from "@/types/validation";
import type { MarketContext } from "./decisionEngine";

export type ActionPlan = {
  timeline: string;
  actions: string[];
  successCriteria: string[];
};

export class ActionPlanGenerator {
  static generate(decision: "PROCEED" | "REVIEW" | "NO-GO", scores: Scores, marketContext: MarketContext): ActionPlan {
    switch (decision) {
      case "NO-GO":
        return this.generateStopPlan(marketContext);
      case "PROCEED":
        return this.generateValidationPlan();
      case "REVIEW":
        return this.generateReviewPlan(scores);
      default:
        return this.generateDefaultPlan();
    }
  }

  static generateStopPlan(marketContext: MarketContext): ActionPlan {
    return {
      timeline: "Immediate",
      actions: [
        "STOP pursuing this specific idea.",
        "Research alternative opportunities in less saturated markets.",
        "Interview experts in adjacent industries for unmet needs.",
        "Evaluate pivot opportunities based on your skills and network.",
        ...(marketContext?.category?.toLowerCase().includes("project")
          ? [
              "Investigate vertical project management niches (construction, legal, healthcare).",
              "Assess compliance-heavy workflows where incumbents struggle.",
            ]
          : []),
      ],
      successCriteria: [
        "Identify 3+ alternative opportunity areas.",
        "Complete competitive landscape analysis for new ideas.",
        "Validate personal fit with alternative directions.",
      ],
    };
  }

  static generateValidationPlan(): ActionPlan {
    return {
      timeline: "6-8 weeks",
      actions: [
        "Complete 15+ customer discovery interviews and capture quantifiable pain signals.",
        "Create MVP landing page or waitlist to test demand and messaging.",
        "Validate pricing willingness with target customers via surveys or pre-orders.",
        "Test primary acquisition channel with small paid/organic experiments.",
      ],
      successCriteria: [
        "70%+ of interviews confirm urgent pain point.",
        "5%+ landing-page-to-signup conversion rate.",
        "Clear willingness to pay at target price point.",
      ],
    };
  }

  static generateReviewPlan(scores: Scores): ActionPlan {
    const weakest = Object.entries(scores)
      .filter(([, value]) => Number.isFinite(value))
      .sort((a, b) => a[1] - b[1])
      .slice(0, 2)
      .map(([dimension]) => dimension);

    return {
      timeline: "4-6 weeks",
      actions: [
        weakest.length ? `Run focused experiments to raise ${weakest.join(" and ")} scores.` : "Investigate weakest scoring dimensions.",
        "Deepen customer discovery where evidence is thin.",
        "Revisit pricing, CAC, and differentiation assumptions with data.",
      ],
      successCriteria: [
        "Documented evidence lifting weakest scores by at least 2 points.",
        "Validated CAC/payback model showing path to ≤18-month payback.",
        "Refined positioning validated with multiple ICP prospects.",
      ],
    };
  }

  static generateDefaultPlan(): ActionPlan {
    return {
      timeline: "4 weeks",
      actions: [
        "Conduct 10+ customer discovery conversations.",
        "Prototype key features and gather targeted feedback.",
        "Validate willingness to pay through pricing conversations.",
      ],
      successCriteria: [
        "Clear articulation of top 3 customer pain points.",
        "Evidence of demand from early adopter interviews.",
        "Initial CAC/payback model with reasonable assumptions.",
      ],
    };
  }
}

export default ActionPlanGenerator;
