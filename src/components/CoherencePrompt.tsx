import React from 'react';
import type { CoherenceAssessment } from '@/lib/coherence';
import { Progress } from '@/components/ui/progress';

export interface CoherencePromptProps {
  ideaText: string;
  assessment: CoherenceAssessment;
  onRevise?: (revisedIdea: string) => void;
}

const CoherencePrompt: React.FC<CoherencePromptProps> = ({ ideaText, assessment, onRevise }) => {
  const [revisedIdea, setRevisedIdea] = React.useState(ideaText);
  return (
    <div className="space-y-6 p-6 bg-red-50 border-2 border-red-200 rounded-lg">
      <div className="flex items-start space-x-3">
        <div className="h-6 w-6 flex items-center justify-center">⚠️</div>
        <div className="flex-1">
          <h3 className="text-lg font-semibold text-red-900">Your Idea Contains Contradictions</h3>
          <p className="text-red-800 mt-1">Resolve logical conflicts before running validation for more accurate results.</p>
        </div>
      </div>

      <div className="bg-white rounded-lg p-4 border border-red-200">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium text-gray-700">Coherence Score</span>
          <span className="text-sm font-semibold text-red-600">{assessment.coherenceScore}/100</span>
        </div>
        <Progress value={assessment.coherenceScore} className="h-2" />
        <p className="text-xs text-gray-600 mt-2">Need 60+ for validation. {assessment.issues.length} conflict{assessment.issues.length !== 1 ? 's' : ''} detected.</p>
      </div>

      {assessment.detectedModels.length > 0 && (
        <div className="bg-white rounded-lg p-4 border border-red-200">
          <h4 className="font-medium text-gray-900 mb-2">Models combined:</h4>
          <div className="flex flex-wrap gap-2">
            {assessment.detectedModels.map((m) => (
              <span key={m} className="px-3 py-1 bg-red-100 text-red-800 rounded-full text-sm font-medium capitalize">{m}</span>
            ))}
          </div>
          <p className="text-sm text-gray-600 mt-2">Pick one as the primary focus.</p>
        </div>
      )}

      <div className="space-y-4">
        <h4 className="font-medium text-gray-900">Contradictions Found:</h4>
        {assessment.issues.map((issue, i) => (
          <div key={i} className="bg-white rounded-lg p-4 border border-red-200">
            <div className="flex items-start space-x-3">
              <div className="h-5 w-5 flex items-center justify-center mt-0.5">❌</div>
              <div className="flex-1 space-y-2">
                <h5 className="font-medium text-gray-900">{issue.description}</h5>
                <p className="text-sm text-gray-700">{issue.explanation}</p>
                <div className="bg-blue-50 rounded p-3 space-y-1">
                  <p className="text-sm font-medium text-blue-900">How to fix:</p>
                  {issue.suggestions.map((s, j) => (<p key={j} className="text-sm text-blue-800">• {s}</p>))}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="space-y-3">
        <label className="block">
          <span className="text-sm font-medium text-gray-900">Revise Your Idea (Remove Contradictions):</span>
          <textarea
            value={revisedIdea}
            onChange={(e) => setRevisedIdea(e.target.value)}
            className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500"
            rows={4}
            placeholder="Rewrite with ONE clear business model, removing contradictions..."
          />
        </label>
        <button onClick={() => onRevise?.(revisedIdea)} className="w-full bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 transition-colors font-medium">
          Validate Coherent Idea
        </button>
      </div>
    </div>
  );
};

export default CoherencePrompt;
