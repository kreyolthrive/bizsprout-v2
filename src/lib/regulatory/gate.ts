// src/lib/regulatory/gate.ts
import { RED_FLAGS } from "./rules";
import { askPerplexity, askLLMStructured } from "@/lib/research";
import type { RegulatoryGateResult, RegulatoryFinding } from "@/types/validation";

export async function runRegulatoryGate(input: { idea_text: string; jurisdictions: ('US'|'EU'|'CA'|'UK'|'OTHER')[] }): Promise<RegulatoryGateResult> {
  const text = input.idea_text || "";
  const flags = RED_FLAGS.filter((r) => r.pattern.test(text));
  if (flags.some((f) => f.severity === 'BLOCKER')) {
    return {
      status: 'FAIL',
      headline: 'Potential illegality / prohibited practice detected',
      findings: [{
        jurisdiction: 'US',
        severity: 'BLOCKER',
        statutes: ['CCPA/CPRA', 'State privacy acts'],
        issues: ['Sale of personal data'],
        notes: 'Selling personal data without granular, revocable consent is likely unlawful in several jurisdictions.',
        estimated_costs: [
          { line_item: 'Privacy counsel & DPIAs', range_usd: [100_000, 300_000] },
          { line_item: 'Compliance program (consent, DSAR, opt-out)', range_usd: [150_000, 400_000] },
          { line_item: 'Security (SOC2/ISO prep)', range_usd: [150_000, 300_000] },
        ],
      }],
      recommendation: 'DO_NOT_PROCEED',
      suggested_pivots: [
        'Anonymous, aggregated insights only (no personal data)',
        'Consent-first research panel with verified opt-in',
        'Survey-based insights with clear participant compensation',
      ],
    };
  }

  // Quick research-assisted scan (best effort; skip if API keys absent)
  let findings: RegulatoryFinding[] = [];
  try {
    const jList = input.jurisdictions.join(', ');
    const researchPrompt = `List major compliance regimes, common violations, typical fines, and recent precedent relevant to this idea across: ${jList}. Idea: ${text}`;
    const research = await askPerplexity(researchPrompt);
    const llmPrompt = `Synthesize a concise list of RegulatoryFinding objects for the following idea, considering jurisdictions ${jList}. Use plain statutes names and concise issues.\nIdea: ${text}\nResearch:\n${research || 'n/a'}`;
    const summary = await askLLMStructured(llmPrompt);
    findings = Array.isArray(summary?.findings) ? summary.findings : [];
  } catch {}

  const hasHigh = findings.some((f) => f.severity === 'HIGH' || f.severity === 'BLOCKER');
  if (hasHigh) {
    return {
      status: 'REVIEW',
      headline: 'High compliance risk detected',
      findings,
      recommendation: 'CONSULT_COUNSEL',
    };
  }
  return {
    status: 'PASS',
    headline: 'No critical red flags detected',
    findings,
    recommendation: 'PIVOT_TO_COMPLIANT',
  };
}

