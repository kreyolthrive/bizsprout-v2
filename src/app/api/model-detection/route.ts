import { NextRequest } from 'next/server';
import { detectBusinessModelWithPriority, getPivotsForBusinessModel, calculatePivotScore, type CategoryPivotOption, validateBusinessModelDetection } from '@/lib/contextualPivots';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const ideaText = String(body?.ideaText || '');
    const currentScore = Number(body?.currentScore || 0);
    const runValidation = Boolean(body?.runValidation);

    if (runValidation) {
      const results = validateBusinessModelDetection();
      return new Response(JSON.stringify(results), { headers: { 'content-type': 'application/json' } });
    }

    const businessModel = detectBusinessModelWithPriority(ideaText);
    const pivots = getPivotsForBusinessModel(businessModel.primaryType);

    const scored = (pivots as CategoryPivotOption[]).map((p) => ({
      option: p,
      overall: calculatePivotScore(p.scoringFactors),
      delta: calculatePivotScore(p.scoringFactors) - currentScore,
      scoringBreakdown: p.scoringFactors,
    })).filter((x) => x.delta >= 15).slice(0, 4);

    const analysis = {
      businessModel,
      availablePivots: pivots.map((p) => ({
        id: p.id,
        label: p.label,
        description: p.description,
        tam: p.tam,
        growth: p.growth,
        competition: p.competition,
      })),
      validPivots: scored.map((s) => ({
        id: s.option.id,
        label: s.option.label,
        description: s.option.description,
        overall: s.overall,
        delta: s.delta,
        scoringBreakdown: s.scoringBreakdown,
      })),
    } as const;

    return new Response(JSON.stringify(analysis), { headers: { 'content-type': 'application/json' } });
  } catch {
    return new Response(JSON.stringify({ error: 'Internal Server Error' }), { status: 500 });
  }
}
