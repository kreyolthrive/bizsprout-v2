// Classifier stub: wraps heuristic inference and optional ML call
import { inferModelFromHints, type BusinessModelKey } from '@/lib/adaptiveValidation';
import type { ClassificationPort, ClassificationInput, ClassificationResult } from './ports';

export class LocalClassifier implements ClassificationPort {
  async classifyFast(input: ClassificationInput): Promise<ClassificationResult> {
    const model = inferModelFromHints(input.hints || {});
    const confidence = 0.6; // heuristic baseline
    return { model, confidence, notes: ['heuristic-inference'] };
  }

  // classifyML is intentionally unimplemented here; wire to a service when available
}

// Placeholder signature for a future ML service client
export type TsneSpectralRequest = { text: string; features?: Record<string, number> };
export type TsneSpectralResponse = { model: BusinessModelKey; confidence: number; features?: Record<string, number> };

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export async function tsneSpectralClassify(_req: TsneSpectralRequest): Promise<TsneSpectralResponse> {
  throw new Error('ml-service-unavailable');
}
