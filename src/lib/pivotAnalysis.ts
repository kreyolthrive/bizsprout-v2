import { PIVOT_DOMAINS, type DomainSnapshot } from '@/lib/pivotDomains';

export interface PivotScore {
  domain: string;
  overall: number;
  delta: number;
  scoringBreakdown: Record<string, number>;
  marketIntelligence: DomainSnapshot;
}

export interface PivotAnalysisRequest {
  originalIdea: string;
  currentScore: number;
  userProfile?: { skills: string[]; interests: string[]; experience: string[] };
}

export interface PivotAnalysisResponse {
  topPicks: PivotScore[];
  fallbackOptions: PivotScore[];
  marketComparison: {
    original: { score: number; constraints: string[] };
    alternatives: PivotScore[];
  };
}

export function calculatePivotScore(domain: DomainSnapshot, baselineScore: number): PivotScore {
  const weights = { problem: 0.2, underserved: 0.15, demand: 0.25, differentiation: 0.15, economics: 0.15, gtm: 0.1 } as const;
  let weightedSum = 0;
  const scoringBreakdown: Record<string, number> = {};
  (Object.keys(weights) as Array<keyof typeof weights>).forEach((dim) => {
    const score = domain.scoringFactors[dim];
    scoringBreakdown[dim] = score;
    weightedSum += score * weights[dim];
  });
  const overall = Math.round(weightedSum);
  const delta = overall - baselineScore;
  return { domain: domain.label, overall, delta, scoringBreakdown, marketIntelligence: domain };
}

export async function analyzePivotOpportunities(request: PivotAnalysisRequest): Promise<PivotAnalysisResponse> {
  const allPivots = Object.values(PIVOT_DOMAINS).map((domain) => calculatePivotScore(domain, request.currentScore));
  const viablePivots = allPivots.filter((p) => p.delta >= 20).sort((a, b) => b.overall - a.overall);
  const personalizedPivots = viablePivots.slice(0, 4);
  return {
    topPicks: personalizedPivots.slice(0, 2),
    fallbackOptions: personalizedPivots.slice(2),
    marketComparison: {
      original: { score: request.currentScore, constraints: getOriginalConstraints(request.originalIdea) },
      alternatives: personalizedPivots,
    },
  };
}

export function getOriginalConstraints(idea: string): string[] {
  const lower = (idea || '').toLowerCase();
  if (lower.includes('project management')) {
    return ['95% market saturation', '$50B incumbent advantages', 'Generic feature expectations', '$400-800 CAC vs $29 pricing'];
  }
  if (lower.includes('freelance') || lower.includes('marketplace')) {
    return ['Two-sided market challenges', 'Incumbent platform dominance', 'High acquisition costs', 'Disintermediation risk'];
  }
  return ['Market saturation', 'Competitive pressure', 'Customer acquisition challenges'];
}
