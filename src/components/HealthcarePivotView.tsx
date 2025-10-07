import React, { useEffect, useState } from 'react';
import type { CategoryPivotOption, HealthcarePivotAnalysis } from '@/lib/contextualPivots';
import { generateHealthcareValidatedPivots } from '@/lib/contextualPivots';

export interface HealthcarePivotViewProps {
  ideaText: string;
  currentScore: number; // 0..100
}

export const HealthcarePivotView: React.FC<HealthcarePivotViewProps> = ({ ideaText, currentScore }) => {
  const [analysis, setAnalysis] = useState<HealthcarePivotAnalysis | null>(null);
  const [loading, setLoading] = useState(true);
  const debugMode = process.env.NODE_ENV === 'development';

  useEffect(() => {
    setLoading(true);
    try {
      const result = generateHealthcareValidatedPivots(ideaText, currentScore);
      setAnalysis(result);
    } catch (err) {
      console.error('Healthcare pivot generation failed:', err);
      setAnalysis(null);
    } finally {
      setLoading(false);
    }
  }, [ideaText, currentScore]);

  if (loading) {
    return <div className="p-6 bg-slate-50 rounded-lg animate-pulse">Loading pivots...</div>;
  }

  if (!analysis) {
    return (
      <div className="p-6 bg-red-50 rounded-lg border border-red-200">
        <p className="text-red-700">Failed to generate pivot analysis</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Business Model Detection */}
      <div className="bg-purple-50 p-4 rounded-lg border border-purple-200">
        <h4 className="font-medium text-purple-900 mb-2">
          Detected: {analysis.businessModel.primaryType.toUpperCase()}
          {analysis.businessModel.subType ? ` (${analysis.businessModel.subType})` : ''}
        </h4>
        <div className="text-purple-700 text-sm space-y-1">
          <div>Confidence: {Math.round(analysis.businessModel.confidence * 100)}%</div>
          <div>Key indicators: {analysis.businessModel.indicators.join(', ')}</div>
          {analysis.businessModel.reasoningChain && debugMode && (
            <details className="mt-2">
              <summary className="cursor-pointer font-medium">Detection Reasoning</summary>
              <ul className="mt-1 space-y-1 text-xs">
                {analysis.businessModel.reasoningChain.map((reason, i) => (
                  <li key={i}>• {reason}</li>
                ))}
              </ul>
            </details>
          )}
        </div>
      </div>

      {/* Valid Pivots */}
      {analysis.validPivots.length > 0 ? (
        <div className="space-y-4">
          <h4 className="text-lg font-medium text-gray-900">Healthcare-Specific Alternatives</h4>
          {analysis.validPivots.map((pivot, index) => (
            <HealthcarePivotCard key={pivot.option.id} pivot={pivot} rank={index + 1} />
          ))}
        </div>
      ) : (
        <div className="p-6 bg-yellow-50 rounded-lg border border-yellow-200">
          <p className="text-yellow-800">No suitable Healthcare pivots found with meaningful improvement potential.</p>
        </div>
      )}

      {/* Debug Info */}
      {debugMode && analysis.invalidPivots.length > 0 && (
        <div className="p-4 bg-gray-50 rounded-lg border">
          <h5 className="font-medium text-gray-900 mb-2">Debug: Filtered Pivots</h5>
          <ul className="text-sm text-gray-600 space-y-1">
            {analysis.invalidPivots.map((invalid) => (
              <li key={invalid.option.id}>• {invalid.option.label}: {invalid.reason}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};

interface HealthcarePivotCardProps {
  pivot: {
    option: CategoryPivotOption;
    overall: number;
    delta: number;
    scoringBreakdown: Record<string, number>;
  };
  rank: number;
}

const HealthcarePivotCard: React.FC<HealthcarePivotCardProps> = ({ pivot, rank }) => {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="bg-white border rounded-lg p-4 hover:shadow-sm transition-shadow">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3 flex-1">
          <div className="flex-shrink-0 w-8 h-8 bg-purple-100 rounded-full flex items-center justify-center text-sm font-medium text-purple-600">
            #{rank}
          </div>
          <div className="flex-1">
            <h5 className="font-medium text-gray-900">{pivot.option.label}</h5>
            <p className="text-sm text-gray-600 mt-1">{pivot.option.description}</p>
            <div className="text-xs text-gray-500 mt-1">TAM: {pivot.option.tam} • CAC: {pivot.option.cacRange}</div>
          </div>
        </div>
        <div className="flex items-center space-x-3">
          <div className="text-right">
            <div className="text-lg font-semibold text-gray-900">{pivot.overall}%</div>
            <div className="text-sm text-purple-600 bg-purple-50 px-2 py-1 rounded">+{pivot.delta} points</div>
          </div>
          <button onClick={() => setExpanded(!expanded)} className="text-gray-400 hover:text-gray-600 text-xl">
            {expanded ? '−' : '+'}
          </button>
        </div>
      </div>

      {expanded && (
        <div className="mt-4 pt-4 border-t space-y-4">
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <strong>Growth:</strong> {pivot.option.growth}
            </div>
            <div>
              <strong>LTV Range:</strong> {pivot.option.ltv}
            </div>
          </div>

          <div>
            <strong className="text-sm">Major Competitors:</strong>
            <div className="flex flex-wrap gap-2 mt-1">
              {pivot.option.majorCompetitors.slice(0, 4).map((c) => (
                <span key={c} className="px-2 py-1 bg-gray-100 rounded text-xs">{c}</span>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <strong className="text-sm">Key Opportunities:</strong>
              <ul className="text-sm text-gray-600 mt-1 space-y-1">
                {pivot.option.opportunities.slice(0, 3).map((o) => (
                  <li key={o}>• {o}</li>
                ))}
              </ul>
            </div>
            <div>
              <strong className="text-sm">Market Barriers:</strong>
              <ul className="text-sm text-gray-600 mt-1 space-y-1">
                {pivot.option.barriers.slice(0, 3).map((b) => (
                  <li key={b}>• {b}</li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default HealthcarePivotView;
