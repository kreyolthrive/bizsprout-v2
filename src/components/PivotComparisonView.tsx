import React, { useEffect, useState } from 'react';
import type { PivotAnalysisResponse, PivotScore } from '@/lib/pivotAnalysis';

export interface PivotComparisonViewProps {
  originalIdea: string;
  currentScore: number;
  userProfile?: { skills: string[]; interests: string[]; experience: string[] };
}

export const PivotComparisonView: React.FC<PivotComparisonViewProps> = ({ originalIdea, currentScore, userProfile }) => {
  const [pivotAnalysis, setPivotAnalysis] = useState<PivotAnalysisResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [selectedPivot, setSelectedPivot] = useState<PivotScore | null>(null);

  useEffect(() => {
    let aborted = false;
    const load = async () => {
      setLoading(true);
      try {
        const res = await fetch('/api/pivot-analysis', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ originalIdea, currentScore, userProfile })
        });
        if (!aborted && res.ok) {
          const data: PivotAnalysisResponse = await res.json();
          setPivotAnalysis(data);
        }
      } catch {
        if (!aborted) setPivotAnalysis(null);
      } finally {
        if (!aborted) setLoading(false);
      }
    };
    load();
    return () => { aborted = true; };
  }, [originalIdea, currentScore, userProfile]);

  if (loading) {
    return (
      <div className="p-6 bg-slate-50 rounded-lg">
        <div className="animate-pulse">
          <div className="h-6 bg-slate-200 rounded w-1/3 mb-4" />
          <div className="space-y-3">
            {[1,2,3].map(i => <div key={i} className="h-16 bg-slate-200 rounded" />)}
          </div>
        </div>
      </div>
    );
  }

  if (!pivotAnalysis) {
    return (
      <div className="p-6 bg-red-50 rounded-lg border border-red-200">
        <p className="text-red-700">Failed to load pivot analysis. Please try again.</p>
      </div>
    );
  }

  const Card: React.FC<{ pivot: PivotScore; rank: number; selected?: boolean; onClick: () => void }> = ({ pivot, rank, selected, onClick }) => {
    const deltaColor = pivot.delta >= 40 ? 'text-green-600 bg-green-50' : pivot.delta >= 25 ? 'text-blue-600 bg-blue-50' : 'text-orange-600 bg-orange-50';
    return (
      <div className={`p-4 rounded-lg border cursor-pointer transition-all ${selected ? 'border-blue-500 bg-blue-50 shadow-md' : 'border-gray-200 bg-white hover:border-gray-300 hover:shadow-sm'}`} onClick={onClick}>
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="flex-shrink-0 w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center text-sm font-medium text-gray-600">#{rank}</div>
            <div>
              <h5 className="font-medium text-gray-900">{pivot.domain}</h5>
              <p className="text-sm text-gray-600">TAM: {pivot.marketIntelligence.tam}</p>
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

  const DetailPanel: React.FC<{ pivot: PivotScore; onClose: () => void }> = ({ pivot, onClose }) => (
    <div className="bg-white border rounded-lg p-6 shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <h4 className="text-lg font-medium text-gray-900">{pivot.domain}</h4>
        <button onClick={onClose} className="text-gray-400 hover:text-gray-600">×</button>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="space-y-4">
          <h5 className="font-medium text-gray-900 mb-2">Market Overview</h5>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between"><span className="text-gray-600">TAM:</span><span className="font-medium">{pivot.marketIntelligence.tam}</span></div>
            <div className="flex justify-between"><span className="text-gray-600">Growth:</span><span className="font-medium">{pivot.marketIntelligence.growth}</span></div>
            <div className="flex justify-between"><span className="text-gray-600">CAC Range:</span><span className="font-medium">{pivot.marketIntelligence.cacRange}</span></div>
            <div className="flex justify-between"><span className="text-gray-600">LTV Range:</span><span className="font-medium">{pivot.marketIntelligence.ltv}</span></div>
          </div>
          <div>
            <h5 className="font-medium text-gray-900 mb-2">Key Competitors</h5>
            <div className="flex flex-wrap gap-2">
              {pivot.marketIntelligence.majorCompetitors.map(c => <span key={c} className="px-2 py-1 bg-gray-100 rounded text-sm text-gray-700">{c}</span>)}
            </div>
          </div>
        </div>
        <div className="space-y-4">
          <h5 className="font-medium text-gray-900 mb-2">Scoring Breakdown</h5>
          <div className="space-y-3">
            {Object.entries(pivot.scoringBreakdown).map(([dimension, score]) => (
              <div key={dimension}>
                <div className="flex justify-between text-sm mb-1"><span className="capitalize text-gray-600">{dimension}</span><span className="font-medium">{score}/100</span></div>
                <div className="w-full">
                  <div className="flex gap-0.5">
                    {Array.from({ length: 20 }).map((_, i) => {
                      const filled = i < Math.max(0, Math.min(20, Math.round(score / 5)));
                      return <span key={i} className={`${filled ? 'bg-blue-500' : 'bg-gray-200'} h-2 flex-1 rounded-sm`} />;
                    })}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6 pt-6 border-t">
        <div>
          <h5 className="font-medium text-gray-900 mb-2">Key Opportunities</h5>
          <ul className="space-y-1 text-sm">
            {pivot.marketIntelligence.opportunities.map(o => (<li key={o} className="flex items-start"><span className="h-2 w-2 bg-green-500 rounded-full mt-2 mr-2" /><span className="text-gray-700">{o}</span></li>))}
          </ul>
        </div>
        <div>
          <h5 className="font-medium text-gray-900 mb-2">Market Barriers</h5>
          <ul className="space-y-1 text-sm">
            {pivot.marketIntelligence.barriers.map(b => (<li key={b} className="flex items-start"><span className="h-2 w-2 bg-orange-400 rounded-full mt-2 mr-2" /><span className="text-gray-700">{b}</span></li>))}
          </ul>
        </div>
      </div>
    </div>
  );

  const MarketComparison: React.FC<{ original: { score: number; constraints: string[] }; alternatives: PivotScore[] }> = ({ original, alternatives }) => (
    <div className="bg-gray-50 rounded-lg p-6">
      <h4 className="text-lg font-medium text-gray-900 mb-4">Market Opportunity Comparison</h4>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200">
              <th className="text-left py-3 px-4 font-medium text-gray-900">Opportunity</th>
              <th className="text-left py-3 px-4 font-medium text-gray-900">Score</th>
              <th className="text-left py-3 px-4 font-medium text-gray-900">Delta</th>
              <th className="text-left py-3 px-4 font-medium text-gray-900">Primary Advantage</th>
            </tr>
          </thead>
          <tbody>
            <tr className="border-b border-gray-100 bg-red-50">
              <td className="py-3 px-4 font-medium text-gray-900">Current Idea</td>
              <td className="py-3 px-4 text-red-600 font-medium">{original.score}%</td>
              <td className="py-3 px-4 text-gray-500">—</td>
              <td className="py-3 px-4 text-gray-700">{original.constraints[0]}</td>
            </tr>
            {alternatives.map(pivot => (
              <tr key={pivot.domain} className="border-b border-gray-100">
                <td className="py-3 px-4 font-medium text-gray-900">{pivot.domain}</td>
                <td className="py-3 px-4 text-green-600 font-medium">{pivot.overall}%</td>
                <td className="py-3 px-4 text-green-600 font-medium">+{pivot.delta}</td>
                <td className="py-3 px-4 text-gray-700">{pivot.marketIntelligence.opportunities[0]}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 p-6 rounded-lg border border-blue-200">
        <h3 className="text-xl font-semibold text-gray-900 mb-2">Alternative Opportunities</h3>
        <p className="text-gray-700">Based on current market constraints, these pivots offer better structural positioning:</p>
      </div>

      <div className="space-y-4">
        <h4 className="text-lg font-medium text-gray-900">Top Recommendations</h4>
        {pivotAnalysis.topPicks.map((p, i) => (
          <Card key={p.domain} pivot={p} rank={i + 1} selected={selectedPivot?.domain === p.domain} onClick={() => setSelectedPivot(p)} />
        ))}
      </div>

      {pivotAnalysis.fallbackOptions.length > 0 && (
        <div className="space-y-4">
          <h4 className="text-lg font-medium text-gray-900">Additional Options</h4>
          {pivotAnalysis.fallbackOptions.map((p, i) => (
            <Card key={p.domain} pivot={p} rank={pivotAnalysis.topPicks.length + i + 1} selected={selectedPivot?.domain === p.domain} onClick={() => setSelectedPivot(p)} />
          ))}
        </div>
      )}

      {selectedPivot && (<DetailPanel pivot={selectedPivot} onClose={() => setSelectedPivot(null)} />)}

      <MarketComparison original={pivotAnalysis.marketComparison.original} alternatives={pivotAnalysis.marketComparison.alternatives} />
    </div>
  );
};
