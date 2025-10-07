// Ports for hexagonal architecture around adaptive validation
import type { BusinessModelKey, DimensionKey } from '@/lib/adaptiveValidation';

export type ClassificationInput = {
  text: string;
  hints?: { businessModel?: string; category?: string; flags?: string[] };
};

export type ClassificationResult = {
  model: BusinessModelKey;
  confidence: number; // 0..1
  features?: Record<string, number>;
  notes?: string[];
};

export interface ClassificationPort {
  classifyFast(input: ClassificationInput): Promise<ClassificationResult>; // heuristic/local
  classifyML?(input: ClassificationInput): Promise<ClassificationResult>; // optional remote
}

export type RuleAction =
  | { type: 'flag'; code: string; message?: string }
  | { type: 'gate'; dimension: DimensionKey | 'overall'; action: 'review' | 'fail'; reason?: string };

export type RuleDefinition = {
  id: string;
  when: string; // constrained expression language
  then: RuleAction[];
  description?: string;
  version?: string;
  enabled?: boolean;
};

export type RuleEvaluationContext = Record<string, unknown> & {
  model: BusinessModelKey;
  saturationPct?: number;
  dimensions10?: Record<DimensionKey, number>;
};

export interface RuleEnginePort {
  list(): Promise<RuleDefinition[]>;
  upsert(rule: RuleDefinition): Promise<void>;
  evaluate(rules: RuleDefinition[], ctx: RuleEvaluationContext): Promise<RuleAction[]>;
}

export interface ValidationPort {
  // Orchestrates scoring using adaptiveValidation and domain calculators
  compute(ctx: {
    model: BusinessModelKey;
    saturationPct: number;
    dimensions10: Record<DimensionKey, number>;
  }): Promise<{
    overall100PreCaps: number;
    overall100PostCaps: number;
    gateViolations: Partial<Record<DimensionKey, string>>;
    appliedCaps: string[];
  }>;
}

export interface PersistencePort {
  get<T>(key: string): Promise<T | null>;
  set<T>(key: string, value: T, opts?: { ex?: number }): Promise<void>;
}

export interface EventPort {
  emit(event: string, payload: Record<string, unknown>): void;
}

export interface ABTestPort {
  allocate(key: string, variants: string[], seed?: string): string;
  track(event: string, data: Record<string, unknown>): void;
}

export type CircuitState = 'closed' | 'open' | 'half-open';
export interface CircuitBreaker {
  state(): CircuitState;
  exec<T>(fn: () => Promise<T>): Promise<T>;
}
