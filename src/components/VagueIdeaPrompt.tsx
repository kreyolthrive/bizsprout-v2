import React from 'react';
import { assessVagueness } from '@/lib/vagueness';
import { getProgressiveFeedback } from '@/lib/feedback';
import { Progress } from '@/components/ui/progress';

export interface VagueIdeaPromptProps {
  ideaText: string;
  onRevise?: (revisedIdea: string) => void;
}

export const VagueIdeaPrompt: React.FC<VagueIdeaPromptProps> = ({ ideaText, onRevise }) => {
  const assessment = assessVagueness(ideaText);
  const [revisedIdea, setRevisedIdea] = React.useState(ideaText);

  if (!assessment.isVague) return null;

  return (
    <div className="space-y-6 p-6 bg-orange-50 border-2 border-orange-200 rounded-lg">
      {/* Header */}
      <div className="flex items-start space-x-3">
        <div className="h-6 w-6 flex items-center justify-center">⚠️</div>
        <div className="flex-1">
          <h3 className="text-lg font-semibold text-orange-900">Your Idea Needs More Specificity</h3>
          <p className="text-orange-800 mt-1">
            We can&apos;t accurately validate ideas that are too vague. To get meaningful insights, please provide concrete details about your business concept.
          </p>
        </div>
      </div>

      {/* Vagueness Metrics */}
      <div className="bg-white rounded-lg p-4 border border-orange-200">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium text-gray-700">Specificity Score</span>
          <span className="text-sm font-semibold text-orange-600">{Math.round(assessment.confidence)}/100</span>
        </div>
        <Progress value={Math.round(assessment.confidence)} className="h-2" />
        <p className="text-xs text-gray-600 mt-2">Aim for 60+ to get accurate validation. Currently missing key details.</p>
        <p className="text-sm text-gray-700 mt-2">{getProgressiveFeedback(Math.round(assessment.confidence))}</p>
      </div>

      {/* Missing Elements */}
      <div className="space-y-4">
  <h4 className="font-medium text-gray-900">What&apos;s Missing:</h4>
        {assessment.missingElements.map((element, index) => (
          <div key={element} className="bg-white rounded-lg p-4 border border-orange-200">
            <div className="flex items-start space-x-3">
              <div className="h-5 w-5 flex items-center justify-center mt-0.5">❌</div>
              <div className="flex-1 space-y-2">
                <h5 className="font-medium text-gray-900">{element}</h5>
                <p className="text-sm text-gray-700">{assessment.specificityPrompts[index]}</p>
                <div className="bg-gray-50 rounded p-2 text-sm">
                  <code className="text-gray-800">{assessment.examples[index]}</code>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Examples of Good Ideas */}
      <div className="bg-white rounded-lg p-4 border border-green-200">
        <div className="flex items-start space-x-2 mb-3">
          <div className="h-5 w-5 flex items-center justify-center mt-0.5">✅</div>
          <h4 className="font-medium text-gray-900">Examples of Specific Ideas:</h4>
        </div>
        <ul className="space-y-2 text-sm text-gray-700">
          <li>Chrome extension for B2B sales teams that auto-fills Salesforce contact fields by scraping LinkedIn profiles. $29/month per user.</li>
          <li>Mobile app helping parents of kids with ADHD track medication adherence and share reports with doctors. Freemium with $9.99/month premium tier.</li>
          <li>API that integrates with construction project management software to automatically generate compliance reports. $500/month flat fee.</li>
        </ul>
      </div>

      {/* Revision Input */}
      <div className="space-y-3">
        <label className="block">
          <span className="text-sm font-medium text-gray-900">Revise Your Idea:</span>
          <textarea
            value={revisedIdea}
            onChange={(e) => setRevisedIdea(e.target.value)}
            className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
            rows={4}
            placeholder="Rewrite your idea with specific details about who, what, how, and pricing..."
          />
        </label>
        <button
          onClick={() => onRevise?.(revisedIdea)}
          className="w-full bg-orange-600 text-white px-4 py-2 rounded-lg hover:bg-orange-700 transition-colors font-medium"
        >
          Validate Revised Idea
        </button>
      </div>

      {/* Helper Tips */}
      <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
        <h4 className="font-medium text-blue-900 mb-2">Quick Tips</h4>
        <ul className="space-y-1 text-sm text-blue-800">
          <li>• Use numbers and metrics when possible (hours saved, % improvement)</li>
          <li>• Name specific industries, roles, or company sizes</li>
          <li>• Describe the actual interface/delivery (dashboard, app, API, etc.)</li>
          <li>• Include clear pricing structure</li>
          <li>• Focus on one specific use case rather than being broad</li>
        </ul>
      </div>
    </div>
  );
};

export interface ValidationGateProps {
  ideaText: string;
  onProceed: () => void;
  onRevise: (revisedIdea: string) => void;
}

export const ValidationGate: React.FC<ValidationGateProps> = ({ ideaText, onProceed, onRevise }) => {
  const assessment = assessVagueness(ideaText);
  if (assessment.isVague) {
    return <VagueIdeaPrompt ideaText={ideaText} onRevise={onRevise} />;
  }
  return (
    <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
      <div className="flex items-center space-x-2">
        <span>✅</span>
        <p className="text-green-800">Idea is specific enough for validation. Proceeding with analysis...</p>
      </div>
      <button onClick={onProceed} className="mt-3 bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700">Proceed</button>
    </div>
  );
};

export default VagueIdeaPrompt;
