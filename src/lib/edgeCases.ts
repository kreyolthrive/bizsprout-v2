// src/lib/edgeCases.ts
// Edge case routing and learning feedback for the adaptive validator.

import type { ValidateResponse, ValidationInput, Scores } from '@/lib/hybrid/validation-types';
import { HybridValidationService } from '@/lib/hybrid/hybridValidation';
import { assessMarketSaturation } from '@/lib/marketSaturation';

export type EdgeCaseType = 'illegal_content' | 'insufficient_data' | 'ambiguous_model' | 'saturated_market' | 'other';

export interface EdgeCaseHandler {
  process(caseData: unknown): Promise<ValidateResponse>;
}

class TrainingPipeline {
  async addResolvedCase(_caseData: unknown, _resolution: ValidateResponse): Promise<void> {
    void _caseData; void _resolution; // no-op stub; wire to storage/queue in the future
  }
}

class CalibrationSystem {
  async incorporateFeedback(_caseData: unknown, _resolution: ValidateResponse): Promise<void> {
    void _caseData; void _resolution; // no-op stub; adjust calibration weights in the future
  }
}

function minimalScores(overall: number): Scores {
  const clamp = (n: number, min = 0, max = 100) => Math.max(min, Math.min(max, Math.round(n)));
  return {
    problem: 0,
    underserved: 0,
    feasibility: 0,
    differentiation: 0,
    demand_signals: 0,
    willingness_to_pay: 0,
    market_quality: 0,
    gtm: 0,
    execution: 0,
    risk: 5,
    overall: clamp(overall)
  };
}

// ---- Default Handlers ----
class IllegalContentHandler implements EdgeCaseHandler {
  async process(caseData: unknown): Promise<ValidateResponse> {
    const idea = ((caseData as ValidationInput)?.idea_text || '').slice(0, 200);
    return {
      id: 'edge-illegal',
      status: 'NO-GO',
      value_prop: idea,
      highlights: [],
      risks: ['Content appears illegal or prohibited'],
      scores: minimalScores(0),
    };
  }
}

class InsufficientDataHandler implements EdgeCaseHandler {
  async process(caseData: unknown): Promise<ValidateResponse> {
    const idea = ((caseData as ValidationInput)?.idea_text || '').slice(0, 200);
    return {
      id: 'edge-insufficient',
      status: 'REVIEW',
      value_prop: idea,
      highlights: ['Provide more detail on the problem, target customer, and validation signals'],
      risks: ['Insufficient information to validate'],
      scores: minimalScores(40),
    };
  }
}

class AmbiguousModelHandler implements EdgeCaseHandler {
  private strategy = new HybridValidationService();
  async process(caseData: unknown): Promise<ValidateResponse> {
    // Attempt a best-effort validation using hybrid defaults
    const input = ((caseData || {}) as ValidationInput);
    const result = await this.strategy.validateBusinessIdea(input);
    return result as unknown as ValidateResponse;
  }
}

class SaturatedMarketHandler implements EdgeCaseHandler {
  async process(caseData: unknown): Promise<ValidateResponse> {
    const idea = ((caseData as ValidationInput)?.idea_text || '');
    const sat = assessMarketSaturation(idea);
    if (sat && sat.penalty) {
      return {
        id: 'edge-saturated',
        status: sat.saturation >= 90 ? 'NO-GO' : 'REVIEW',
        value_prop: idea.slice(0, 200),
        highlights: ['Saturation risk detected'],
        risks: [
          `Oversaturation (~${sat.saturation}%)`,
          `Competitors: ${sat.competitors.join(', ')}`,
          `Recommendation: target niche or alternative go-to-market`
        ],
        scores: minimalScores(sat.saturation >= 90 ? 25 : 45),
      };
    }
    return {
      id: 'edge-saturated-none',
      status: 'REVIEW',
      value_prop: idea.slice(0, 200),
      highlights: ['No strong saturation penalty found'],
      risks: [],
      scores: minimalScores(55),
    };
  }
}

export class EdgeCaseManager {
  private caseHandlers: Map<EdgeCaseType, EdgeCaseHandler> = new Map();
  private trainingPipeline = new TrainingPipeline();
  private calibrationSystem = new CalibrationSystem();

  constructor() {
    // Register defaults
    this.caseHandlers.set('illegal_content', new IllegalContentHandler());
    this.caseHandlers.set('insufficient_data', new InsufficientDataHandler());
    this.caseHandlers.set('ambiguous_model', new AmbiguousModelHandler());
    this.caseHandlers.set('saturated_market', new SaturatedMarketHandler());
  }

  register(type: EdgeCaseType, handler: EdgeCaseHandler) {
    this.caseHandlers.set(type, handler);
  }

  async routeEdgeCase(case_data: unknown, caseType: EdgeCaseType): Promise<ValidateResponse> {
    const handler = this.caseHandlers.get(caseType);
    if (!handler) return this.escalateToHumanReview(case_data, caseType);
    const result = await handler.process(case_data);
    await this.updateLearningSystem(case_data, result);
    return result;
  }

  private async escalateToHumanReview(caseData: unknown, caseType: EdgeCaseType): Promise<ValidateResponse> {
    const idea = ((caseData as ValidationInput)?.idea_text || '').slice(0, 200);
    return {
      id: 'edge-human',
      status: 'REVIEW',
      value_prop: idea,
      highlights: ['Escalated to human reviewer'],
      risks: [`Unhandled edge case type: ${caseType}`],
      scores: minimalScores(50),
    };
  }

  private async updateLearningSystem(caseData: unknown, resolution: ValidateResponse): Promise<void> {
    await this.trainingPipeline.addResolvedCase(caseData, resolution);
    await this.calibrationSystem.incorporateFeedback(caseData, resolution);
  }
}
