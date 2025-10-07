// src/lib/riskAssessment.ts
// Reusable risk & execution assessment with drivers, mitigations, and compliance detection

export type Severity = 'high' | 'medium' | 'info';

export interface RiskDriver {
  label: string;
  severity: Severity;
  strategies: string[];
}

export interface RiskScores {
  risk?: number;       // 0-100
  execution?: number;  // 0-100
}

export interface RiskAssessment {
  scores: RiskScores;
  drivers: RiskDriver[];
  complianceFlags: string[]; // e.g., ['HIPAA', 'OSHA']
}

export interface BuildRiskAssessmentInput {
  rawScores?: { risk?: number; execution?: number };
  scores?: { moat?: number; distribution?: number; economics?: number }; // typically 0-10
  notes?: { benchmarkNote?: string; highlights?: string[]; rawRisks?: string[] };
  metrics?: { cac?: number; activation?: number };
}

const COMPLIANCE_RE = /(hipaa|phi|baa|ferpa|pci|osha|soc2|gdpr)/i;
const CROWDED_RE = /(saturation|crowded|red ocean|too many competitors|undifferentiated)/i;

function to100(x?: number | null): number | undefined {
  if (typeof x !== 'number' || Number.isNaN(x)) return undefined;
  // Heuristic: assume 0-10 means scale to 0-100; if already > 10, treat as 0-100
  return x <= 10 ? Math.round(x * 10) : Math.round(x);
}

function extractComplianceFlags(text: string): string[] {
  const found = new Set<string>();
  const lower = text.toLowerCase();
  if (/hipaa|phi|baa/.test(lower)) found.add('HIPAA');
  if (/ferpa/.test(lower)) found.add('FERPA');
  if (/pci/.test(lower)) found.add('PCI');
  if (/osha/.test(lower)) found.add('OSHA');
  if (/soc2/.test(lower)) found.add('SOC2');
  if (/gdpr/.test(lower)) found.add('GDPR');
  return Array.from(found);
}

export function buildRiskAssessment(input: BuildRiskAssessmentInput): RiskAssessment {
  const rawText = [
    input?.notes?.benchmarkNote || '',
    ...(Array.isArray(input?.notes?.highlights) ? input!.notes!.highlights! : []),
    ...(Array.isArray(input?.notes?.rawRisks) ? input!.notes!.rawRisks! : []),
  ]
    .map((x) => String(x).toLowerCase())
    .join('\n');

  const crowded = CROWDED_RE.test(rawText);
  const complianceFlags = extractComplianceFlags(rawText);

  const moat100 = to100(input?.scores?.moat);
  const dist100 = to100(input?.scores?.distribution);
  const econ100 = to100(input?.scores?.economics);

  const cac = input?.metrics?.cac;
  const act = input?.metrics?.activation;

  const highCAC = typeof cac === 'number' && cac >= 600;
  const medCAC = typeof cac === 'number' && cac >= 400 && cac < 600;
  const lowAct = typeof act === 'number' && act < 25;
  const medAct = typeof act === 'number' && act >= 25 && act < 40;
  const weakMoat = typeof moat100 === 'number' && moat100 < 40;
  const weakDist = typeof dist100 === 'number' && dist100 < 40;
  const weakEcon = typeof econ100 === 'number' && econ100 < 40;

  const drivers: RiskDriver[] = [];
  if (crowded || weakMoat) {
    drivers.push({
      label: 'Crowded market / low differentiation',
      severity: crowded ? 'high' : 'medium',
      strategies: [
        'Pick a niche: choose one vertical and build workflow-specific templates.',
        'Ship 1–2 integrations unique to the niche (data in/out that others ignore).',
        'Lead with a wedge: 1 killer feature that solves a painful job end-to-end.',
      ],
    });
  }
  if (highCAC || medCAC) {
    drivers.push({
      label: highCAC ? 'High CAC (>$600)' : 'Moderate CAC ($400–$600)',
      severity: highCAC ? 'high' : 'medium',
      strategies: [
        'Run paid pilot offers to raise intent and shorten sales cycles.',
        'Add referral/partner channels (resellers, local associations).',
        'Publish 2–3 case studies before scaling paid channels.',
      ],
    });
  }
  if (lowAct || medAct) {
    drivers.push({
      label: lowAct ? 'Low activation (<25%)' : 'Weak activation (25–40%)',
      severity: lowAct ? 'high' : 'medium',
      strategies: [
        'Instrument “aha” events and build a first-run checklist.',
        'Add template library + guided onboarding (inline tips, checklists).',
        'Offer concierge onboarding to first 10 customers.',
      ],
    });
  }
  if (weakDist) {
    drivers.push({
      label: 'Distribution risk (channels unproven)',
      severity: 'medium',
      strategies: [
        'Test 2 low-cost channels (cold email + niche community) for 2 weeks.',
        'Partner with 1–2 ecosystem tools for co-marketing.',
        'Stand up a simple ROI calculator/worksheet to increase response rates.',
      ],
    });
  }
  if (weakEcon) {
    drivers.push({
      label: 'Unit economics weak',
      severity: 'medium',
      strategies: [
        'Raise price for higher-touch tier; keep self-serve as lead-in.',
        'Reduce churn with success checkpoints in first 30/60/90 days.',
        'Bundle 1 premium integration to increase willingness to pay.',
      ],
    });
  }
  if (COMPLIANCE_RE.test(rawText)) {
    drivers.push({
      label: 'Compliance exposure',
      severity: 'high',
      strategies: [
        'Limit PHI/PII by default; add “restricted mode” and data retention controls.',
        'Prepare BAA/DPA templates; document audit logging/data access.',
        'Choose hosting with regional controls and encryption at rest/in transit.',
      ],
    });
  }

  if (!drivers.length) {
    drivers.push({
      label: 'No critical risks detected',
      severity: 'info',
      strategies: [
        'Keep pilots scoped with clear success metrics (conversion, activation, ROI).',
        'Document learnings weekly; prioritize what measurably improves scores.',
      ],
    });
  }

  // Preserve any provided raw scores without inference for now
  const scores: RiskScores = {
    risk: typeof input?.rawScores?.risk === 'number' ? Math.round(input!.rawScores!.risk!) : undefined,
    execution: typeof input?.rawScores?.execution === 'number' ? Math.round(input!.rawScores!.execution!) : undefined,
  };

  return { scores, drivers, complianceFlags };
}
