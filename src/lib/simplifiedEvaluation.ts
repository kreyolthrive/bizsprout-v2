// src/lib/simplifiedEvaluation.ts
// Simplified Business Evaluation Framework (0–5 gates + weighted score)

import { extractIdeaComponents, inferBusinessType } from "@/lib/validationFramework";
import { RED_FLAGS } from "@/lib/regulatory/rules";

// ---- Types ----
export type ClarifyComponents = {
  problem?: string;
  solution?: string;
  customers?: string;
  revenue?: string;
};

export type ClarifyResult = {
  restatement: string;
  missingInfo: string[];
  assumptions: string[];
  components: ClarifyComponents;
};

export const FOUR_U_CRITERIA: Record<string, Record<number, string>> = {
  urgent: {
    5: "Problem causes immediate business/personal crisis",
    4: "Problem creates significant daily frustration",
    3: "Problem is annoying but manageable",
    2: "Problem is minor inconvenience",
    1: "Problem is barely noticeable",
    0: "No real problem exists",
  },
  unavoidable: {
    5: "Problem affects everyone in target market",
    4: "Problem affects 80%+ of target market",
    3: "Problem affects 60%+ of target market",
    2: "Problem affects 40%+ of target market",
    1: "Problem affects 20%+ of target market",
    0: "Problem affects very few people",
  },
  underserved: {
    5: "No adequate solutions exist",
    4: "Existing solutions are significantly inadequate",
    3: "Existing solutions have notable gaps",
    2: "Existing solutions work but could be better",
    1: "Good solutions exist with minor issues",
    0: "Excellent solutions already exist",
  },
  unworkable: {
    5: "Current solutions completely fail to solve problem",
    4: "Current solutions work poorly with major limitations",
    3: "Current solutions work but with significant friction",
    2: "Current solutions work adequately with minor issues",
    1: "Current solutions work well with small room for improvement",
    0: "Current solutions work perfectly",
  },
};

export type FourUScores = {
  urgent: number;
  unavoidable: number;
  underserved: number;
  unworkable: number;
};

export type GateResult<T = any> = {
  scores?: unknown;
  totalScore?: number;
  maxPossible?: number;
  passed: boolean;
  recommendation?: string;
  reasoning?: string;
} & T;

// ---- Step 1: Idea clarity ----
export function clarifyIdea(description: string): ClarifyResult {
  const text = (description || "").trim();
  const components: ClarifyComponents = {
    problem: extractProblem(text),
    solution: extractSolution(text),
    customers: extractCustomers(text),
    revenue: extractRevenueModel(text),
  };
  const missing: string[] = [];
  if (!components.problem) missing.push("What specific problem does this solve?");
  if (!components.customers) missing.push("Who are your target customers?");
  if (!components.solution) missing.push("What is your proposed solution?");
  const restatement = generateOneLineSummary(components);
  const assumptions = generateAssumptions(components);
  return { restatement, missingInfo: missing, assumptions, components };
}

// Naive extractors (deterministic heuristics; replaceable with LLMs later)
function extractProblem(text: string): string | undefined {
  const t = text.toLowerCase();
  if (/maintain|update|security|backups?/.test(t)) return "Keeping websites updated, secure, and backed up";
  if (/invoice|billing|payments?/.test(t)) return "Time-consuming invoicing and payment collection";
  if (/leads?|customers?/.test(t)) return "Generating and converting qualified leads";
  return undefined;
}

function extractSolution(text: string): string | undefined {
  const ic = extractIdeaComponents(text);
  if (ic?.solution) return ic.solution;
  if (/maintenance|updates?/.test(text.toLowerCase())) return "Maintenance service";
  if (/app|software|platform|tool/.test(text.toLowerCase())) return "Software tool";
  return undefined;
}

function extractCustomers(text: string): string | undefined {
  const ic = extractIdeaComponents(text);
  if (ic?.customers && !/target customers/i.test(ic.customers)) return ic.customers;
  const t = text.toLowerCase();
  if (/freelance\s+web\s*designer/.test(t)) return "Existing web design clients";
  if (/small\s*(business|biz|smb)/.test(t)) return "Small businesses";
  if (/e-?com|shopify|woocommerce|store/.test(t)) return "E‑commerce brands";
  return undefined;
}

function extractRevenueModel(text: string): string | undefined {
  const t = text.toLowerCase();
  if (/subscription|monthly|retainer/.test(t)) return "Monthly subscription";
  if (/one[- ]?time|project|setup/.test(t)) return "Project/one‑time fee";
  return undefined;
}

function generateOneLineSummary(c: ClarifyComponents): string {
  const sol = c.solution || "solution";
  const cust = c.customers || "customers";
  const prob = c.problem || "a real problem";
  const method = c.revenue || "a simple offering";
  return `A ${sol} that helps ${cust} solve ${prob} by ${method}.`;
}

function generateAssumptions(c: ClarifyComponents): string[] {
  const a = new Set<string>();
  if (c.problem) a.add("Users experience this problem frequently");
  if (c.customers) a.add("Customers are reachable via common channels");
  if (c.solution) a.add("Proposed solution addresses core pain effectively");
  if (c.revenue) a.add("Buyers accept the proposed pricing model");
  if (!a.size) return ["Key assumptions are not yet specified; validate with interviews."];
  return Array.from(a);
}

// ---- Step 2: 4U Test (Gate 1) ----
export function evaluateFourU(problemDescription: string | undefined, marketContext?: string): GateResult<{ scores: FourUScores; }>{
  const base: FourUScores = { urgent: 2, unavoidable: 2, underserved: 2, unworkable: 2 };
  const t = (problemDescription || "").toLowerCase() + " " + (marketContext || "").toLowerCase();
  const bump = (k: keyof FourUScores, by = 1) => (base[k] = Math.max(0, Math.min(5, base[k] + by)));
  if (/crisis|down|outage|security|revenue|urgent|deadline/.test(t)) bump("urgent", 2);
  if (/daily|every\s*day|weekly|recurring|ongoing/.test(t)) bump("urgent", 1);
  if (/everyone|most|majority|widespread|common/.test(t)) bump("unavoidable", 2);
  if (/niche|some|few/.test(t)) bump("unavoidable", -1);
  if (/no\s+(good|adequate)\s+solutions?|manual|spreadsheet|workarounds?/.test(t)) bump("underserved", 2);
  if (/competitor|tool|platform|solution/.test(t)) bump("underserved", -1);
  if (/manual|error|slow|fragile/.test(t)) bump("unworkable", 1);
  if (/works\s+well|mature|established/.test(t)) bump("unworkable", -1);

  const scores = base;
  const total = scores.urgent + scores.unavoidable + scores.underserved + scores.unworkable;
  const passGate1 = [scores.urgent, scores.unavoidable, scores.underserved, scores.unworkable].filter((s) => s >= 4).length >= 2;
  return {
    scores,
    totalScore: total,
    maxPossible: 20,
    passed: passGate1,
    recommendation: passGate1 ? "PROCEED" : "NO-GO",
    reasoning: passGate1
      ? "Strong signals on urgency and/or underserved; proceed to customer validation."
      : "Insufficient strength across 4U dimensions; consider narrowing problem or pivoting.",
  };
}

// ---- Step 3: Customer Validation (Gate 2) ----
type Segment = { name: string; size: number; pains: string[]; alternatives?: string[] };

export function analyzeCustomerSegments(businessDescription: string, problemScores: FourUScores): GateResult<{ allSegments: unknown[]; primarySegment: unknown }>{
  const segments = generateCustomerSegments(businessDescription);
  const scored = segments.map((s) => ({
    ...s,
    reachability: scoreReachability(s),
    painLevel: scorePainLevel(s, problemScores),
    payingCapability: scorePayingCapability(s),
  }));
  const withTotals = scored.map((s) => ({
    ...s,
    totalScore: s.reachability + s.painLevel + s.payingCapability, // 0–15
  }));
  const primary = [...withTotals].sort((a, b) => b.totalScore - a.totalScore)[0];
  return { allSegments: withTotals, primarySegment: primary, passed: (primary?.totalScore ?? 0) >= 12 };
}

function generateCustomerSegments(text: string): Segment[] {
  const t = text.toLowerCase();
  const out: Segment[] = [];
  if (/web\s*design|website|wordpress|shopify|woocommerce/.test(t)) {
    out.push({ name: "Small business owners", size: 2_000_000, pains: ["Website upkeep", "Lead gen"], alternatives: ["Freelancers", "Agencies"] });
    out.push({ name: "Existing web design clients", size: 500_000, pains: ["Maintenance", "Performance", "Security"], alternatives: ["Do nothing", "DIY"] });
    out.push({ name: "E‑commerce brands", size: 300_000, pains: ["Conversion", "Speed", "Integrations"], alternatives: ["Apps", "Agencies"] });
  } else {
    out.push({ name: "Early adopters in niche market", size: 200_000, pains: ["Manual workflows", "Fragmented tools"], alternatives: ["Spreadsheets"] });
    out.push({ name: "SMB teams", size: 1_000_000, pains: ["Time loss", "Coordination"], alternatives: ["Generic tools"] });
    out.push({ name: "Consultants/Freelancers", size: 800_000, pains: ["Admin", "Client mgmt"], alternatives: ["DIY"] });
  }
  return out;
}

function scoreReachability(s: Segment): number {
  if (s.name.includes("Existing web design")) return 5; // warm access
  if (/SMB|Small business/i.test(s.name)) return 4;
  return 3;
}
function scorePainLevel(_s: Segment, fourU: FourUScores): number {
  return Math.min(5, Math.max(1, Math.round((fourU.urgent + fourU.underserved) / 2)));
}
function scorePayingCapability(s: Segment): number {
  if (/E‑commerce|E-commerce|brand/i.test(s.name)) return 5;
  if (/SMB|Small/.test(s.name)) return 4;
  return 3;
}

// ---- Step 4: Solution Validation (Gate 3) ----
export function validateSolutionFit(solution: string | undefined, primarySegment: unknown, problemScores: FourUScores): GateResult<{ painCoverage: number; differentiation: number; adoptionFriction: number; }>{
  const pains = (primarySegment?.pains || []) as string[];
  const sol = (solution || "").toLowerCase();
  const hits = pains.filter((p) => sol.includes("mainten") ? /upkeep|maint|security|update/.test(p.toLowerCase()) : true).length;
  const painCoverage = Math.min(5, Math.max(1, hits >= 3 ? 4 : hits >= 2 ? 3 : 2));
  const differentiation = /maintenance|niche|special|for small teams|for smbs/.test(sol) ? 4 : 3;
  const adoptionFriction = 5 - Math.min(4, Math.round(problemScores.urgent / 2)); // lower better; convert to 0–5
  const totalScore = (painCoverage + differentiation + (5 - adoptionFriction)) / 3; // 0–5
  const passed = painCoverage >= 3 && differentiation >= 3;
  return { painCoverage, differentiation, adoptionFriction, totalScore, passed } as any;
}

// ---- Step 5: Market Validation (Gate 4) ----
export function analyzeMarketSize(primarySegment: unknown, _solution?: string, _geo?: string): GateResult<{ tam: number; sam: number; som: number; method: string; confidence: "low" | "medium" | "high"; }>{
  const base = Math.max(100_000, Number(primarySegment?.size || 200_000));
  const tam = base;
  const sam = Math.round(tam * 0.2);
  const som = Math.round(sam * 0.02) * 100; // assume $100 ARPU/mo → annualized later by consumer
  const passed = som >= 1_000_000; // $1M threshold
  return { tam, sam, som, method: "heuristic_bottom_up", confidence: "low", passed };
}

export function analyzeCompetition(solution?: string, primarySegment?: unknown) {
  const sol = (solution || "").toLowerCase();
  const direct = /website|wordpress|shopify/.test(sol)
    ? ["Agencies", "Local freelancers", "Upwork"]
    : ["Incumbent tools"];
  const indirect = ["Spreadsheets", "Do nothing", "Generic tools"];
  return [
    { type: "Direct Competitors", examples: direct, threat: "HIGH", advantage: "Productized, transparent pricing" },
    { type: "Indirect Alternatives", examples: indirect, threat: "MEDIUM", advantage: "Time savings and reliability" },
    { type: "Status Quo", examples: ["Manual processes"], threat: "LOW", advantage: "Automation + accountability" },
  ];
}

// ---- Step 6: Business Model Validation (Gate 5) ----
export function analyzePricing(solution?: string, _segment?: unknown, _competition?: unknown[]): GateResult<{ model: string; entryPrice: number; anchorPrice: number; margin: number }>{
  const sol = (solution || "").toLowerCase();
  const model = /maintenance|service/.test(sol) ? "Monthly subscription (retainer)" : "Monthly subscription";
  const entryPrice = /maintenance/.test(sol) ? 200 : 29;
  const anchorPrice = /maintenance/.test(sol) ? 499 : 79;
  const margin = /service|maintenance/.test(sol) ? 70 : 85; // heuristic
  return { model, entryPrice, anchorPrice, margin, passed: margin >= 70 } as any;
}

// ---- Overall Scoring ----
export const SCORING_WEIGHTS = {
  problemStrength: 0.30,
  customerValidation: 0.25,
  solutionFit: 0.20,
  marketOpportunity: 0.15,
  businessModel: 0.10,
};

export function calculateFinalScore(gateScores: Record<keyof typeof SCORING_WEIGHTS, number>): number {
  const weighted = Object.entries(SCORING_WEIGHTS).reduce((acc, [k, w]) => acc + (gateScores[k as keyof typeof SCORING_WEIGHTS] * (w as number)), 0);
  return Math.round(weighted * 20); // 0–100
}

export const DECISION_RULES = {
  GO: {
    condition: (score: number, gates: GateResult[]) => score >= 75 && gates.every((g) => g.passed),
    message: "Strong opportunity - proceed with confidence",
    nextSteps: "Develop MVP and begin customer validation",
  },
  CONDITIONAL_GO: {
    condition: (score: number, gates: GateResult[]) => score >= 60 && gates.filter((g) => g.passed).length >= 4,
    message: "Promising opportunity with specific areas to address",
    nextSteps: "Address identified weaknesses before proceeding",
  },
  NEED_WORK: {
    condition: (score: number) => score >= 40,
    message: "Concept has potential but needs significant refinement",
    nextSteps: "Pivot or significantly improve weak areas",
  },
  NO_GO: {
    condition: (score: number) => score < 40,
    message: "Fundamental issues make this opportunity unviable",
    nextSteps: "Consider a different approach or problem",
  },
} as const;

export function applyDecisionRules(score: number, gates: GateResult[]) {
  for (const [label, rule] of Object.entries(DECISION_RULES)) {
    // @ts-ignore
    if (rule.condition(score, gates)) return { label, message: rule.message, nextSteps: rule.nextSteps };
  }
  return { label: "NO_GO", message: DECISION_RULES.NO_GO.message, nextSteps: DECISION_RULES.NO_GO.nextSteps };
}

// Convenience aggregator to build the full simplified evaluation in one call
export function buildSimplifiedEvaluation(ideaText: string) {
  const clarification = clarifyIdea(ideaText);
  const gate0 = evaluateRegulatoryEthics(ideaText);
  const gate1 = evaluateFourU(clarification.components.problem);
  const gate2 = analyzeCustomerSegments(ideaText, gate1.scores as FourUScores);
  const gate3 = validateSolutionFit(clarification.components.solution, (gate2 as any).primarySegment, gate1.scores as FourUScores);
  const market = analyzeMarketSize((gate2 as any).primarySegment, clarification.components.solution);
  const comp = analyzeCompetition(clarification.components.solution, (gate2 as any).primarySegment);
  const gate4: GateResult = { ...market, competition: comp, passed: market.passed } as any;
  const gate5 = analyzePricing(clarification.components.solution, (gate2 as any).primarySegment, comp);

  const gatesArray = [gate0 as GateResult, gate1 as GateResult, gate2 as GateResult, gate3 as GateResult, gate4 as GateResult, gate5 as GateResult];
  const score = calculateFinalScore({
    problemStrength: Math.min(5, Math.max(0, (gate1.totalScore || 0) / 4)), // normalize 0–20 → 0–5
    customerValidation: Math.min(5, Math.max(0, ((gate2 as any).primarySegment?.totalScore || 0) / 3)), // 0–15 → 0–5
    solutionFit: Math.min(5, Math.max(0, (gate3.totalScore as number) || 0)),
    marketOpportunity: market.passed ? 4 : 2,
    businessModel: Math.min(5, Math.max(0, (gate5.passed ? 4.5 : 2))),
  } as any);
  const decision = applyDecisionRules(score, gatesArray);
  return { clarification, gate0, gate1, gate2, gate3, gate4, gate5, finalScore: score, decision };
}

// Optional class wrapper matching the spec (non-async for now)
export class BusinessIdeaEvaluator {
  async evaluateIdea(businessDescription: string, _userContext?: unknown) {
    // Note: In this implementation we do not early-return; we always produce a full structured output.
    return buildSimplifiedEvaluation(businessDescription);
  }
}
// ---- Gate 0: Regulatory & Ethics ----
export function evaluateRegulatoryEthics(text: string): GateResult<{ compliance: number; dataPrivacy: number; safetyEthics: number; notes: string[] }>{
  const t = (text || "").toLowerCase();
  const bt = inferBusinessType(text);
  let compliance = 1; // 0–5 (higher = higher risk)
  let dataPrivacy = 1;
  let safetyEthics = 1;
  const notes: string[] = [];

  // Domain heuristics
  if (bt === "health") { compliance = Math.max(compliance, 4); dataPrivacy = Math.max(dataPrivacy, 5); notes.push("HIPAA/PHI handling required"); }
  if (bt === "fin") { compliance = Math.max(compliance, 4); dataPrivacy = Math.max(dataPrivacy, 4); notes.push("KYC/AML/PCI concerns"); }
  if (bt === "marketplace" && /international|cross[- ]?border|multi[- ]?country/.test(t)) {
    compliance = Math.max(compliance, 3); notes.push("Cross‑border trade, taxes, and shipping compliance");
  }

  // Keyword bumps
  if (/children|minor|student/.test(t)) { safetyEthics = Math.max(safetyEthics, 4); notes.push("Involves minors; heightened safety/consent requirements"); }
  if (/medical|clinic|patient|diagnos|therapy/.test(t)) { safetyEthics = Math.max(safetyEthics, 4); }
  if (/payments?|card|bank|credit|loan/.test(t)) { compliance = Math.max(compliance, 4); }
  if (/personal data|pii|email list|tracking/.test(t)) { dataPrivacy = Math.max(dataPrivacy, 3); }

  // Apply regex red flags
  try {
    for (const rf of RED_FLAGS) {
      if (rf.pattern.test(text)) {
        notes.push(`Red flag: ${rf.label} (${rf.severity})`);
        if (rf.severity === 'BLOCKER') { compliance = Math.max(compliance, 5); dataPrivacy = Math.max(dataPrivacy, 5); }
        else { compliance = Math.max(compliance, 4); dataPrivacy = Math.max(dataPrivacy, 4); }
      }
    }
  } catch {}

  const passed = compliance <= 2 && dataPrivacy <= 3 && safetyEthics <= 3;
  return {
    compliance, dataPrivacy, safetyEthics, notes,
    passed,
    recommendation: passed ? "PROCEED" : "BLOCK",
    reasoning: passed ? "No major compliance blockers detected from description." : "Address regulatory/privacy/ethics requirements before proceeding.",
  } as any;
}
