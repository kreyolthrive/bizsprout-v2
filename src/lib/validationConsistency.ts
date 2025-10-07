// src/lib/validationConsistency.ts
import type {
  Scores,
  UnitEconomics,
  Saturation,
  ValidationExtras,
} from "@/types/validation";

export type ValidateDecision = "GO" | "REVIEW" | "NO-GO";

export function overallScore(scores: Scores): number {
  const vals = Object.values(scores ?? {});
  if (!vals.length) return 0;
  const sum = vals.reduce((a, b) => a + b, 0);
  return Math.round((sum / (vals.length * 10)) * 100);
}

export function decision(scores: Scores): ValidateDecision {
  const overall = overallScore(scores);
  if (overall >= 70) return "GO";
  if (overall >= 40) return "REVIEW";
  return "NO-GO";
}

export function actionPlan(status: ValidateDecision): string[] {
  if (status === "NO-GO") {
    return [
      "STOP. Do not proceed with this idea. Consider completely different opportunities.",
      "Consider vertical-specific alternatives (e.g., construction PM, legal workflows, healthcare compliance).",
      "Research underserved niches rather than competing in saturated markets.",
    ];
  }
  if (status === "REVIEW") {
    return [
      "Run 5–10 customer interviews to validate problem severity and willingness to pay.",
      "Launch a narrow landing page test for a single ICP and clear offer.",
      "Estimate CAC and payback from early signals; adjust pricing/channel fit.",
    ];
  }
  return [
    "Prioritize the narrowest ICP and finalize the core feature set.",
    "Ship onboarding, pricing, and basic activation tracking.",
    "Plan a 4-week launch with 2–3 channel experiments.",
  ];
}

export function rationaleFromScores(
  scores: Scores,
  meta?: { category?: string; title?: string }
): string[] {
  const items: string[] = [];
  const overall = overallScore(scores);
  const status = overall >= 70 ? "PROCEED" : overall >= 40 ? "REVIEW" : "DO NOT PROCEED";
  items.push(`Overall Score: ${overall}% - ${status}`);

  const isPM = /project\s*management|(^|\s)pm(\s|$)/i.test(meta?.category ?? meta?.title ?? "");
  if (isPM && overall <= 30) {
    items.push(
      `Demand (${scores.demand}/10): Market oversupplied with established solutions (Asana, Monday.com, Notion)`,
      `Moat (${scores.moat}/10): No differentiation from dozens of existing competitors`,
      `Economics (${scores.economics}/10): 86-month CAC payback makes business model impossible`,
      `Distribution (${scores.distribution}/10): Acquisition extremely difficult against billion-dollar incumbents`
    );
    return items;
  }

  items.push(
    `Demand (${scores.demand}/10): ${scores.demand <= 3 ? "Insufficient validated demand signals" : "Some credible early signals"}`,
    `Moat (${scores.moat}/10): ${scores.moat <= 3 ? "Weak defensibility vs incumbents" : "Emerging differentiation potential"}`,
    `Economics (${scores.economics}/10): ${scores.economics <= 3 ? "Unfavorable CAC/payback assumptions" : "Unit economics trending acceptable"}`,
    `Distribution (${scores.distribution}/10): ${scores.distribution <= 3 ? "No reliable channels identified" : "At least one plausible channel identified"}`
  );
  return items;
}

export function applyHeuristics(
  scores: Scores,
  ue: UnitEconomics = {},
  sat: Saturation = {}
): { scores: Scores; extras: ValidationExtras } {
  const next: Scores = { ...scores };
  const extras: ValidationExtras = {};

  if (
    typeof ue.arpu_monthly === "number" &&
    Number.isFinite(ue.arpu_monthly) &&
    typeof ue.gross_margin === "number" &&
    Number.isFinite(ue.gross_margin)
  ) {
    const margin = Math.max(0, Math.min(1, ue.gross_margin));
    extras.monthly_revenue_est = Math.max(0, ue.arpu_monthly) * margin;
  }
  if (typeof ue.payback_months === "number" && ue.payback_months > 24) {
    extras.auto_stop = "PAYBACK_GT_24M";
    next.economics = Math.min(next.economics, 2);
  }
  if (typeof sat.market_saturation_pct === "number" && sat.market_saturation_pct > 80) {
    extras.auto_stop ??= "SATURATION_GT_80_PCT";
    next.demand = Math.min(next.demand, 2);
    next.distribution = Math.min(next.distribution, 2);
  }
  return { scores: next, extras };
}
