import React, { useEffect, useState } from 'react';
import type { ValidationRequest, BusinessModelClassification, PivotScore } from '@/lib/contextualPivots';
import { BusinessModelType, getBusinessModelDisplayLabel } from '@/lib/contextualPivots';
import { generateContextualPivots, validatePivotRecommendations } from '@/lib/contextualPivots';

interface BusinessModelAwarePivotViewProps {
  // Validation request may include a backend-provided businessModelOverride
  validationRequest: ValidationRequest;
  /**
   * Direct classification object from API response. If provided it takes precedence over
   * validationRequest.businessModelOverride (which may be derived/cached higher up).
   * This ensures the pivot system always reflects the authoritative server classification
   * without needing parent components to mutate the original request object.
   */
  apiClassification?: BusinessModelClassification;
}

type PivotUI = {
  id: string;
  category: BusinessModelType;
  label: string;
  description: string;
  overall: number;
  delta: number;
  marketSnapshot: { tam: string; growth: string; competition: string; competitors: string[] };
  scoringBreakdown: Record<string, number>;
  barriers: string[];
  opportunities: string[];
  skillMatch: number;
};

const Card: React.FC<{ pivot: PivotUI; rank: number }> = ({ pivot, rank }) => {
  const deltaColor = pivot.delta >= 40 ? 'text-green-600 bg-green-50' : pivot.delta >= 25 ? 'text-blue-600 bg-blue-50' : 'text-orange-600 bg-orange-50';
  return (
    <div className="p-4 rounded-lg border cursor-pointer transition-all border-gray-200 bg-white hover:border-gray-300 hover:shadow-sm">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="flex-shrink-0 w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center text-sm font-medium text-gray-600">#{rank}</div>
          <div>
            <h5 className="font-medium text-gray-900">{pivot.label}</h5>
            <p className="text-sm text-gray-600">TAM: {pivot.marketSnapshot.tam}</p>
          </div>
        </div>
        <div className="text-right">
          <div className="text-lg font-semibold text-gray-900">{pivot.overall}%</div>
          <div className={`text-sm px-2 py-1 rounded-full ${deltaColor}`}>+{pivot.delta} points</div>
        </div>
      </div>
    </div>
  );
};

export const BusinessModelAwarePivotView: React.FC<BusinessModelAwarePivotViewProps> = ({ validationRequest, apiClassification }) => {
  const [analysis, setAnalysis] = useState<{ businessModel: BusinessModelClassification; pivots: PivotUI[] } | null>(null);
  const [loading, setLoading] = useState(true);
  const [errors, setErrors] = useState<string[]>([]);

  useEffect(() => {
    let mounted = true;
    (async () => {
      setLoading(true);
      try {
        // Use apiClassification if provided (takes precedence over any existing businessModelOverride)
        const requestWithClassification = apiClassification
          ? { ...validationRequest, businessModelOverride: apiClassification }
          : validationRequest;
        const a = await generateContextualPivots(requestWithClassification);
        try {
          if (process.env.NEXT_PUBLIC_PIVOT_DEBUG === '1') {
            (window as unknown as { __pivotDebug?: unknown }).__pivotDebug = {
              ts: Date.now(),
              idea: requestWithClassification.ideaText,
              businessModel: a.businessModel,
              rawPivots: a.pivots,
              pivotLabels: a.pivots.map(p => p.label),
            };
            console.debug('[PivotDebug] generated', (window as unknown as { __pivotDebug?: unknown }).__pivotDebug);
          }
        } catch {}
        const validation = validatePivotRecommendations(
          a.businessModel,
          a.pivots.map((p) => ({
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
        if (!validation.isValid) setErrors(validation.errors);
        if (mounted) setAnalysis(a);
      } catch {
        setErrors(["Failed to generate contextual pivots"]);
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, [validationRequest, apiClassification]);

  // No idea revision or vagueness gating here — pivot view is display-only

  if (loading) return <div className="p-6 bg-slate-50 rounded-lg">Loading contextual pivots...</div>;
  if (errors.length) {
    return (
      <div className="p-6 bg-red-50 rounded-lg border border-red-200">
        <h4 className="font-medium text-red-900 mb-2">Pivot System Error</h4>
        <ul className="text-red-700 text-sm space-y-1">{errors.map((e) => (<li key={e}>• {e}</li>))}</ul>
      </div>
    );
  }

  if (!analysis) {
    return <div className="p-6 bg-red-50 rounded-lg border border-red-200">No analysis available.</div>;
  }

  // Low-confidence detection should not block view; show a non-blocking banner instead
  const confidencePct = Math.round((analysis.businessModel.confidence || 0) * 100);
  const isFallback = (analysis.businessModel.indicators || []).some((t) => t.toLowerCase() === 'fallback classification');
  const lowConfidence = confidencePct <= 40 || isFallback;

  const detectedLabel = getBusinessModelDisplayLabel(analysis.businessModel.primaryType);
  const subLabel = analysis.businessModel.subType
    ? analysis.businessModel.subType.replace(/-/g, ' ')
    : '';

  return (
    <div className="space-y-6">
      <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
        <div className="flex items-center justify-between">
          <div>
            <h4 className="font-medium text-blue-900">
              Detected: {detectedLabel}
              {subLabel && (
                <span className="ml-2 text-xs px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 align-middle">
                  {subLabel}
                </span>
              )}
            </h4>
            <p className="text-blue-700 text-sm">Confidence: {Math.round(analysis.businessModel.confidence * 100)}%</p>
          </div>
          <div className="text-xs text-blue-600 truncate max-w-[50%]">{analysis.businessModel.indicators.join(', ')}</div>
        </div>
      </div>

      {lowConfidence && (
        <div className="p-3 rounded-lg border border-amber-200 bg-amber-50 text-amber-900 text-sm">
          Business model detection is low confidence; recommendations may be less precise. You can refine your idea wording and re-validate later for tighter matches.
        </div>
      )}

      {lowConfidence ? (
        <div className="p-4 rounded-lg border border-amber-200 bg-amber-50">
          <h4 className="text-base font-medium text-amber-900 mb-1">Business model unclear</h4>
          <p className="text-amber-900 text-sm">Please add more details for tailored pivot recommendations. Once your idea includes concrete audience, channel, or offering details, we’ll suggest precise alternatives.</p>
        </div>
      ) : (
        <div className="space-y-4">
          <h4 className="text-lg font-medium text-gray-900">Category-Specific Alternatives</h4>
          {(() => {
            // Filter out invalid category combinations before rendering (user-requested logic)
            const isPhysicalSub = analysis?.businessModel?.primaryType === BusinessModelType.PHYSICAL_PRODUCT;
            const audit: Array<{ id: string; label: string; category: string; excluded: boolean; reason?: string }> = [];
            const validPivots = (analysis?.pivots || []).filter(pivot => {
              const cat = String(pivot.category || '').toLowerCase();
              const isHealthcare = cat.includes('healthcare');
              const isFintech = cat.includes('fintech');
              let excluded = false; let reason: string | undefined;
              if (isPhysicalSub && (isHealthcare || isFintech)) {
                excluded = true; reason = 'physical-product:remove-regulated';
              }
              audit.push({ id: pivot.id, label: pivot.label, category: cat, excluded, reason });
              return !excluded;
            });
            try {
              if (process.env.NEXT_PUBLIC_PIVOT_DEBUG === '1') {
                const w = window as unknown as { __pivotDebug?: Record<string, unknown> };
                if (w.__pivotDebug) {
                  w.__pivotDebug.filtered = validPivots.map(p => p.label);
                  w.__pivotDebug.audit = audit;
                }
              }
            } catch {}
            return validPivots.map((pivot, i) => (<Card key={pivot.id || pivot.label} pivot={pivot} rank={i + 1} />));
          })()}
        </div>
      )}
    </div>
  );
};

export default BusinessModelAwarePivotView;
