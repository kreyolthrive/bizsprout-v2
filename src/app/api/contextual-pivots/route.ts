import { NextRequest } from 'next/server';
import { generateContextualPivots, validatePivotRecommendations, type ValidationRequest, type PivotScore } from '@/lib/contextualPivots';

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as ValidationRequest;
    const analysis = await generateContextualPivots(body);

    const validation = validatePivotRecommendations(
      analysis.businessModel,
      analysis.pivots.map((p) => ({
        option: {
            id: p.id,
          category: p.category,
          label: p.label,
          description: p.description,
          tam: p.marketSnapshot.tam,
          growth: p.marketSnapshot.growth,
          competition: p.marketSnapshot.competition,
          majorCompetitors: p.marketSnapshot.competitors,
          cacRange: '-',
          ltv: '-',
          barriers: p.barriers,
          opportunities: p.opportunities,
          scoringFactors: {
            problem: p.scoringBreakdown.problem ?? 0,
            underserved: p.scoringBreakdown.underserved ?? 0,
            demand: p.scoringBreakdown.demand ?? 0,
            differentiation: p.scoringBreakdown.differentiation ?? 0,
            economics: p.scoringBreakdown.economics ?? 0,
            gtm: p.scoringBreakdown.gtm ?? 0,
          },
          relevantSkills: [],
        },
        overall: p.overall,
        delta: p.delta,
        scoringBreakdown: p.scoringBreakdown,
        skillMatch: p.skillMatch ?? 0.5,
      } as PivotScore))
    );

    if (!validation.isValid) {
      return new Response(JSON.stringify({ error: 'Pivot validation failed', details: validation.errors }), { status: 400 });
    }

    return new Response(JSON.stringify(analysis), { headers: { 'content-type': 'application/json' } });
  } catch {
    return new Response(JSON.stringify({ error: 'Internal Server Error' }), { status: 500 });
  }
}
