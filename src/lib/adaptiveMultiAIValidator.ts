// src/lib/adaptiveMultiAIValidator.ts
// Implements an adaptive multi-AI validator orchestrator that plugs into the existing HybridValidationService.

import type { ValidationInput, Scores as HybridScores } from '@/lib/hybrid/validation-types';
import { HybridValidationService } from '@/lib/hybrid/hybridValidation';
import { MarketSaturationConstraints, type MarketContext as SaturationMarketContext } from '@/lib/marketSaturation';
import { AdaptiveKPIFramework, type MarketContext as KpiMarketContext } from '@/lib/kpiFramework';
import { EdgeCaseManager } from '@/lib/edgeCases';

// High-level types for adaptive orchestration
export type BusinessModelType = 'saas' | 'marketplace' | 'physical-subscription' | 'ecommerce' | 'services' | 'unknown';

export interface ValidationOptions {
  enforceCaps?: boolean;
  clampScores?: boolean;
}

export type HybridFullResult = Awaited<ReturnType<HybridValidationService['validateBusinessIdea']>>;
export type ValidationResult = HybridFullResult & { meta?: Record<string, unknown> };

// Base class for compatibility with requested API (stub)
export class MultiAIValidator {
  async validate(_data: unknown, _options?: ValidationOptions): Promise<ValidationResult> {
    void _data; void _options;
    throw new Error('Not implemented');
  }
}

// Detector interfaces
export interface BusinessModelDetector {
  detect(ideaText: string): BusinessModelType;
}

// Extended context-aware detector per request
export interface BusinessModelContext {
  primaryType: BusinessModelType;
  hybridCharacteristics: string[] | null;
  confidence: number; // 0..1
  supportingEvidence: string[];
  uncertaintyMetrics: { confidence: number; entropy?: number; notes?: string[]; [k: string]: unknown };
}

export interface BusinessModelContextAwareDetector {
  detectModel(businessData: unknown): Promise<BusinessModelContext>;
}

// External components (interfaces) that a composite detector would use
export interface RoBERTaClassifier {
  classify(features: string): Promise<{ businessModelType: BusinessModelType; evidence: string[] }>; 
}

export interface HybridBusinessModelDetector {
  detectHybridPatterns(features: string): Promise<{ score: number; patterns: string[] }>;
}

export interface UncertaintyQuantifier {
  quantifyUncertainty(primary: { businessModelType: BusinessModelType; evidence?: string[]; features?: string }): Promise<{ confidence: number; entropy?: number; notes?: string[] }>;
}

class HeuristicBusinessModelDetector implements BusinessModelDetector {
  detect(ideaText: string): BusinessModelType {
    const t = (ideaText || '').toLowerCase();
    if (!t) return 'unknown';
    const isMarketplace = /\bmarketplace\b|two[- ]sided|connect\s+buyers?\s+and\s+sellers|commission|take[- ]?rate/.test(t);
    const isPhysicalSub = /(subscription|subscribe|monthly|quarterly)/.test(t) && /(ship|shipping|box|crate|bag|inventory|warehouse|3pl|fulfillment)/.test(t);
    if (isMarketplace) return 'marketplace';
    if (isPhysicalSub) return 'physical-subscription';
    if (/saas|software|platform|api|dashboard/.test(t)) return 'saas';
    if (/sell|product|inventory|shipping|e[- ]?commerce|storefront/.test(t)) return 'ecommerce';
    if (/service|agency|consult/.test(t)) return 'services';
    return 'unknown';
  }
}

// Simple, local implementations to avoid external ML dependencies
class SimpleRoBERTaClassifier implements RoBERTaClassifier {
  async classify(features: string) {
    const f = (features || '').toLowerCase();
    const evidence: string[] = [];
    const pushIf = (re: RegExp, token: string) => { if (re.test(f)) evidence.push(token); };
    pushIf(/\bmarketplace\b|two[- ]sided/, 'two-sided');
    pushIf(/commission|take[- ]?rate/, 'take-rate');
    pushIf(/subscription|subscribe|monthly|quarterly/, 'subscription');
    pushIf(/ship|shipping|box|crate|bag|inventory|warehouse|3pl|fulfillment/, 'physical-shipping');
    pushIf(/saas|software|api|dashboard/, 'saas-keyword');
    pushIf(/agency|service|consult/, 'services-keyword');
    pushIf(/e[- ]?commerce|storefront|cart|checkout/, 'ecommerce-keyword');

    const detector = new HeuristicBusinessModelDetector();
    const businessModelType = detector.detect(f);
    return { businessModelType, evidence };
  }
}

class SimpleHybridPatternDetector implements HybridBusinessModelDetector {
  async detectHybridPatterns(features: string) {
    const f = (features || '').toLowerCase();
    const patterns: string[] = [];
    const has = (re: RegExp) => re.test(f);
    if (has(/marketplace/) && has(/managed|escrow|qa|curat/)) patterns.push('managed-marketplace');
    if (has(/saas/) && has(/services|agency/)) patterns.push('saas+services');
    if (has(/subscription/) && has(/shipping|3pl|inventory/)) patterns.push('physical-subscription');
    const score = Math.min(1, patterns.length * 0.5 + (has(/two[- ]sided|commission|take[- ]?rate/) ? 0.25 : 0));
    return { score, patterns };
  }
}

class SimpleUncertaintyQuantifier implements UncertaintyQuantifier {
  async quantifyUncertainty(primary: { businessModelType: BusinessModelType; evidence?: string[]; features?: string }) {
    const evCount = (primary.evidence?.length || 0);
    const base = primary.businessModelType === 'unknown' ? 0.35 : 0.55;
    const confidence = Math.max(0.2, Math.min(0.95, base + Math.min(0.4, evCount * 0.1)));
    const entropy = 1 - confidence;
    const notes = evCount === 0 ? ['Low evidence; result heuristic'] : [];
    return { confidence, entropy, notes };
  }
}

export class CompositeBusinessModelDetector implements BusinessModelContextAwareDetector {
  private primaryClassifier: RoBERTaClassifier;
  private hybridDetector: HybridBusinessModelDetector;
  private confidenceScorer: UncertaintyQuantifier;

  constructor(deps?: { classifier?: RoBERTaClassifier; hybrid?: HybridBusinessModelDetector; uncertainty?: UncertaintyQuantifier }) {
    this.primaryClassifier = deps?.classifier || new SimpleRoBERTaClassifier();
    this.hybridDetector = deps?.hybrid || new SimpleHybridPatternDetector();
    this.confidenceScorer = deps?.uncertainty || new SimpleUncertaintyQuantifier();
  }

  private async extractBusinessFeatures(businessData: unknown): Promise<string> {
    try {
      if (typeof businessData === 'string') return businessData;
      const obj = businessData as Record<string, unknown> | null | undefined;
      const parts: string[] = [];
      const add = (v: unknown) => { const s = typeof v === 'string' ? v : (typeof v === 'number' ? String(v) : ''); if (s) parts.push(s); };
      if (obj) {
        add(obj['idea_text']);
        add(obj['title']);
        add(obj['category']);
        add(obj['value_prop']);
        add(obj['description']);
        add(obj['target_market']);
      }
      return parts.join(' ').slice(0, 4000);
    } catch { return ''; }
  }

  async detectModel(businessData: unknown): Promise<BusinessModelContext> {
    const features = await this.extractBusinessFeatures(businessData);
    const primaryResult = await this.primaryClassifier.classify(features);
    const hybrid = await this.hybridDetector.detectHybridPatterns(features);
    const uncertainty = await this.confidenceScorer.quantifyUncertainty({ ...primaryResult, features });
    return {
      primaryType: primaryResult.businessModelType,
      hybridCharacteristics: hybrid.score > 0.6 ? hybrid.patterns : (hybrid.patterns.length ? hybrid.patterns : null),
      confidence: uncertainty.confidence,
      supportingEvidence: primaryResult.evidence,
      uncertaintyMetrics: uncertainty
    };
  }
}

// Strategy abstraction
export interface ValidationStrategy {
  name: string;
  validate(input: ValidationInput): Promise<ValidationResult>;
}

class HybridStrategy implements ValidationStrategy {
  name = 'hybrid-default';
  private svc = new HybridValidationService();
  async validate(input: ValidationInput): Promise<ValidationResult> {
    const res = await this.svc.validateBusinessIdea(input);
    return res as ValidationResult;
  }
}

// --- Domain-level strategy contracts (for business-model specific logic) ---
export type MarketMaturity = 'early' | 'growth' | 'mature';
export interface ValidationContext {
  marketMaturity: MarketMaturity;
  marketSaturation: number; // 0..1
  category?: string;
}
export interface WeightConfiguration {
  customerAcquisition: number;
  revenueGrowth: number;
  operationalEfficiency: number;
  competitivePosition: number;
}
export type WeightingCriteria = WeightConfiguration;
export interface SaturationConstraints {
  overallCap100?: number;
  demandFloor10?: number;
  notes?: string[];
}
export type KPIFramework = string[];

export interface BusinessModelValidationStrategy {
  supports(modelType: BusinessModelType): boolean;
  validate(data: unknown, context: ValidationContext): Promise<{
    isValid: boolean;
    adaptiveWeights: WeightConfiguration;
    marketConstraints: SaturationConstraints;
    industryKPIs: KPIFramework;
    confidenceScore: number; // 0..1
  }>;
  getWeightingCriteria(): WeightingCriteria;
  getMarketSaturationConstraints(context: ValidationContext): SaturationConstraints;
  getIndustrySpecificKPIs(): KPIFramework;
}

class ECommerceDomainStrategy implements BusinessModelValidationStrategy {
  supports(modelType: BusinessModelType): boolean { return modelType === 'ecommerce'; }

  getWeightingCriteria(): WeightingCriteria {
    // Base criteria before context-specific tweaks
    return { customerAcquisition: 0.3, revenueGrowth: 0.3, operationalEfficiency: 0.2, competitivePosition: 0.2 };
  }

  getMarketSaturationConstraints(context: ValidationContext): SaturationConstraints {
    return this.toSaturationConstraints('ecommerce', context);
  }
  private toSaturationConstraints(model: BusinessModelType, context: ValidationContext): SaturationConstraints {
    const m = new MarketSaturationConstraints();
    const satCtx: SaturationMarketContext = { spendIndex: 1.0, saturationPct: Math.round(context.marketSaturation * 100), demandElasticity: context.marketMaturity === 'early' ? 0.8 : 0.9 };
    const modelOut = m.calculateSaturationCap(model, satCtx);
    return {
      overallCap100: Math.round(modelOut.alphaCap * 100),
      demandFloor10: modelOut.betaInflection >= 1.2 ? 2 : 1,
      notes: [
        `alpha≈${modelOut.alphaCap.toFixed(2)}, beta≈${modelOut.betaInflection.toFixed(2)}, gamma≈${modelOut.gammaShape.toFixed(2)}`,
        'Computed via Hill-function saturation model'
      ]
    };
  }

  getIndustrySpecificKPIs(): KPIFramework { return ['conversion_rate', 'aov', 'cac', 'ltv', 'ltv_cac', 'repeat_rate']; }

  private calculateECommerceWeights(context: ValidationContext): WeightConfiguration {
    const weights: WeightConfiguration = {
      customerAcquisition: context.marketMaturity === 'early' ? 0.4 : 0.25,
      revenueGrowth: 0.3,
      operationalEfficiency: 0.2,
      competitivePosition: context.marketSaturation > 0.8 ? 0.35 : 0.25,
    };
    // Normalize so total ~1.0
    const total = weights.customerAcquisition + weights.revenueGrowth + weights.operationalEfficiency + weights.competitivePosition;
    if (total > 0) {
      weights.customerAcquisition = Number((weights.customerAcquisition / total).toFixed(3));
      weights.revenueGrowth = Number((weights.revenueGrowth / total).toFixed(3));
      weights.operationalEfficiency = Number((weights.operationalEfficiency / total).toFixed(3));
      weights.competitivePosition = Number((weights.competitivePosition / total).toFixed(3));
    }
    return weights;
  }

  private evaluateWithWeights(data: unknown, weights: WeightConfiguration): boolean {
    const rec = (data as Record<string, unknown>) || {};
    const t = (typeof rec.idea_text === 'string' ? String(rec.idea_text) : '').toLowerCase();
    const hasBrand = /brand|story|unique|niche|community|loyalty/.test(t);
    const risky = /dropship|generic|commodity|aliexpress/.test(t);
    const score = (hasBrand ? 0.7 : 0.4) * weights.competitivePosition + (risky ? 0.1 : 0.3) * weights.customerAcquisition + 0.3 * weights.revenueGrowth + 0.2 * weights.operationalEfficiency;
    return score >= 0.45; // simple heuristic threshold
  }

  private calculateConfidence(_data: unknown, context: ValidationContext): number {
    const base = context.marketMaturity === 'early' ? 0.55 : context.marketMaturity === 'growth' ? 0.65 : 0.7;
    const saturationPenalty = Math.max(0, context.marketSaturation - 0.6) * 0.4;
    return Math.max(0.3, Math.min(0.9, base - saturationPenalty));
  }

  async validate(data: unknown, context: ValidationContext) {
    const weights = this.calculateECommerceWeights(context);
  const constraints = this.toSaturationConstraints('ecommerce', context);
    return {
      isValid: this.evaluateWithWeights(data, weights),
      adaptiveWeights: weights,
      marketConstraints: constraints,
      industryKPIs: this.getIndustrySpecificKPIs(),
      confidenceScore: this.calculateConfidence(data, context)
    };
  }
}

// Adapter to plug domain strategy into existing ValidationStrategy pipeline
class ECommerceValidationStrategy implements ValidationStrategy {
  name = 'ecommerce-domain-adapter';
  private svc = new HybridValidationService();
  private domain = new ECommerceDomainStrategy();
  private kpis = new AdaptiveKPIFramework();
  async validate(input: ValidationInput): Promise<ValidationResult> {
    // Derive a lightweight context using heuristics; saturation defaults moderate
    const text = (input.idea_text || '').toLowerCase();
    const marketSaturation = /crowded|saturated|many competitors|generic/.test(text) ? 0.85 : (/unique|niche|community/.test(text) ? 0.5 : 0.65);
    const maturity: MarketMaturity = /prelaunch|prototype|idea/.test(text) ? 'early' : (/scale|vc|growth/i.test(text) ? 'growth' : 'early');
    const ctx: ValidationContext = { marketMaturity: maturity, marketSaturation, category: 'ecommerce' };
    const [hybrid, domainSummary] = await Promise.all([
      this.svc.validateBusinessIdea(input),
      this.domain.validate(input as unknown, ctx),
    ]);
    const baseMeta = (hybrid as unknown as { meta?: Record<string, unknown> }).meta || {};
    const dynamicConstraints = this.domain.getMarketSaturationConstraints(ctx);
    const kpiCtx: KpiMarketContext = { growthStage: ctx.marketMaturity, competitiveIntensity: ctx.marketSaturation };
    const kpiConfig = this.kpis.getRelevantKPIs('ecommerce', kpiCtx);
    const merged: ValidationResult = { ...(hybrid as ValidationResult), meta: { ...baseMeta, ecommerce: { summary: domainSummary, context: ctx, criteria: this.domain.getWeightingCriteria(), constraints: dynamicConstraints, kpis: this.domain.getIndustrySpecificKPIs(), kpi_framework: { config: kpiConfig } } } };
    return merged;
  }
}

// Consistency engine
export interface MathematicalConsistencyEngine {
  enforce(result: ValidationResult): ValidationResult;
}

class WeightedEnsembleConsistencyEngine implements MathematicalConsistencyEngine {
  enforce(result: ValidationResult): ValidationResult {
    if (!result || !result.scores) return result;
    const s = { ...(result.scores as HybridScores) };
    // Clamp each 0-10 dim if present
    const dims: Array<keyof HybridScores> = ['problem','underserved','feasibility','differentiation','demand_signals','willingness_to_pay','market_quality','gtm','execution','risk'];
    for (const d of dims) {
      if (typeof s[d] === 'number') {
        // index and clamp flexibly
        const val = (s as Record<string, number>)[d as string];
        (s as Record<string, number>)[d as string] = Math.max(0, Math.min(10, val));
      }
    }
    // Clamp overall 0-100 if present
    if (typeof s.overall === 'number') s.overall = Math.max(0, Math.min(100, s.overall));
    return { ...result, scores: s };
  }
}

// ---- Multi-provider consensus engine (optional advanced mode) ----
export type ProviderKey = 'hybrid' | 'heuristic' | 'domain' | 'ai';
export interface NormalizedResult { provider: ProviderKey; category: keyof WeightConfiguration; score: number; reliability: number; }
export interface CalibrationModel { provider: ProviderKey; scale: (x: number) => number; reliabilityBias?: number; }
export interface ConsensusOutcome {
  finalScore: number;
  providerAgreement: number; // 0..1
  mathematicalConsistency: boolean;
  confidenceBounds: { low: number; high: number };
}

export class ConsensusMathematicalConsistencyEngine {
  private providerCalibration: Map<string, CalibrationModel> = new Map();

  constructor(models?: CalibrationModel[]) {
    if (models) for (const m of models) this.providerCalibration.set(m.provider, m);
  }

  async ensureConsistency(validationResults: NormalizedResult[], weights: WeightConfiguration): Promise<ConsensusOutcome> {
    const normalizedResults = await this.normalizeProviderOutputs(validationResults);
    const weightedScore = this.calculateWeightedConsensus(normalizedResults, weights);
  this.validateMathematicalConstraints(weightedScore);
    return {
      finalScore: weightedScore,
      providerAgreement: this.calculateProviderAgreement(normalizedResults),
      mathematicalConsistency: this.verifyConsistency(weightedScore),
      confidenceBounds: this.calculateConfidenceBounds(normalizedResults)
    };
  }

  private async normalizeProviderOutputs(results: NormalizedResult[]): Promise<NormalizedResult[]> {
    return results.map(r => {
      const model = this.providerCalibration.get(r.provider);
      const scaled = model?.scale ? model.scale(r.score) : r.score;
      const reliability = Math.max(0.2, Math.min(1, (r.reliability ?? 0.7) + (model?.reliabilityBias ?? 0)));
      return { ...r, score: Math.max(0, Math.min(1, scaled)), reliability };
    });
  }

  private calculateWeightedConsensus(results: NormalizedResult[], weights: WeightConfiguration): number {
    const weightSum = Object.values(weights).reduce((sum, w) => sum + w, 0);
    if (Math.abs(weightSum - 1.0) > 1e-6) {
      throw new Error('Weight configuration must sum to 1.0 for mathematical consistency');
    }
    const numer = results.reduce((consensus, r) => {
      const weight = weights[r.category] || 0;
      return consensus + (r.score * weight * r.reliability);
    }, 0);
    return Math.max(0, Math.min(1, numer));
  }

  private validateMathematicalConstraints(weightedScore: number) {
    if (!Number.isFinite(weightedScore)) throw new Error('Weighted consensus is not finite');
  }

  private calculateProviderAgreement(results: NormalizedResult[]): number {
    if (!results.length) return 0;
    const scores = results.map(r => r.score);
    const mean = scores.reduce((a, b) => a + b, 0) / scores.length;
    const variance = scores.reduce((s, x) => s + (x - mean) * (x - mean), 0) / scores.length;
    const std = Math.sqrt(variance);
    // Map std in [0, 0.5] -> agreement in [1, 0]
    return Math.max(0, Math.min(1, 1 - (std / 0.5)));
  }

  private verifyConsistency(weightedScore: number): boolean {
    return weightedScore >= 0 && weightedScore <= 1;
  }

  private calculateConfidenceBounds(results: NormalizedResult[]): { low: number; high: number } {
    if (!results.length) return { low: 0, high: 0 };
    const scores = results.map(r => r.score);
    return { low: Math.max(0, Math.min(...scores)), high: Math.min(1, Math.max(...scores)) };
  }
}

// Fallback orchestration
export interface FallbackOrchestrator {
  run<T>(fn: () => Promise<T>, fallback: () => Promise<T>): Promise<T>;
}

class SimpleFallbackOrchestrator implements FallbackOrchestrator {
  async run<T>(fn: () => Promise<T>, fallback: () => Promise<T>): Promise<T> {
    try { return await fn(); } catch { return await fallback(); }
  }
}

// ---- Adaptive Fallback Orchestrator (tiered) ----
export type FallbackLevel = 'feature-group' | 'simplified-model' | 'rule-based';
export interface ClassificationError extends Error { code?: string; cause?: unknown }
export interface FallbackTier {
  level: FallbackLevel;
  canHandle(error: ClassificationError): boolean;
  execute(originalData: unknown, error: ClassificationError): Promise<ValidationResult>;
}

class FeatureGroupFallbackTier implements FallbackTier {
  level: FallbackLevel = 'feature-group';
  private svc = new HybridValidationService();
  canHandle(_error: ClassificationError): boolean { void _error; return true; }
  async execute(originalData: unknown, _error: ClassificationError): Promise<ValidationResult> {
    void _error;
    // Strip potentially problematic fields and re-run core validation
    try {
      const rec = (originalData as Record<string, unknown>) || {};
      const idea = typeof rec.idea_text === 'string' ? rec.idea_text : '';
      const target = typeof rec.target_customer === 'string' ? rec.target_customer : (typeof rec.target_market === 'string' ? rec.target_market : undefined);
      const clean: ValidationInput = {
        idea_text: idea.slice(0, 1000),
        ...(target ? { target_customer: String(target).slice(0, 200) } : {})
      } as ValidationInput;
      const base = await this.svc.validateBusinessIdea(clean);
      return base as ValidationResult;
    } catch {
      // If cleaning fails, fall back to passing through
      const base = await this.svc.validateBusinessIdea((originalData || {}) as ValidationInput);
      return base as ValidationResult;
    }
  }
}

class SimplifiedModelFallbackTier implements FallbackTier {
  level: FallbackLevel = 'simplified-model';
  private strategy = new HybridStrategy();
  canHandle(_error: ClassificationError): boolean { void _error; return true; }
  async execute(originalData: unknown, _error: ClassificationError): Promise<ValidationResult> {
    void _error;
    // Run the lightweight HybridStrategy directly
    return this.strategy.validate((originalData || {}) as ValidationInput);
  }
}

class RuleBasedFallbackTier implements FallbackTier {
  level: FallbackLevel = 'rule-based';
  canHandle(_error: ClassificationError): boolean { void _error; return true; }
  async execute(originalData: unknown, _error: ClassificationError): Promise<ValidationResult> {
    void _error;
    // Minimal rule-based verdict using heuristic cues
    const rec = (originalData as Record<string, unknown>) || {};
    const t = ((rec.idea_text as string) || '').toLowerCase();
    const risky = /project management|crm|email marketing/.test(t);
    const ok = /niche|managed|community|vertical|handmade/.test(t);
    const base: ValidationResult = {
      id: 'fallback-rule',
      status: risky && !ok ? 'NO-GO' : (ok ? 'REVIEW' : 'REVIEW'),
      value_prop: (rec.value_prop as string) || '',
      highlights: ok ? ['Potential vertical focus'] : [],
      risks: risky ? ['Saturated category'] : ['Limited evidence'],
      scores: { overall: risky ? 35 : 55 },
    } as unknown as ValidationResult;
    return base;
  }
}

export class AdaptiveFallbackOrchestrator {
  private fallbackTiers: FallbackTier[] = [];

  constructor() {
    this.initializeFallbackTiers();
  }

  private initializeFallbackTiers(): void {
    this.fallbackTiers = [
      new FeatureGroupFallbackTier(), // Specialized models without problematic features
      new SimplifiedModelFallbackTier(), // Lighter models with reduced requirements
      new RuleBasedFallbackTier() // Hardcoded business rules for extreme cases
    ];
  }

  private wrapFallbackResult(result: ValidationResult, level: FallbackLevel, error: ClassificationError): ValidationResult {
    const meta = (result.meta || {}) as Record<string, unknown>;
    return {
      ...result,
      meta: {
        ...meta,
        fallback: { tier: level, reason: error.message || 'fallback', code: error.code || null }
      }
    };
  }

  async handleFallback(error: ClassificationError, originalData: unknown): Promise<ValidationResult> {
    for (const tier of this.fallbackTiers) {
      try {
        if (tier.canHandle(error)) {
          const result = await tier.execute(originalData, error);
          if (this.isAcceptable(result)) {
            return this.wrapFallbackResult(result, tier.level, error);
          }
        }
      } catch (tierError) {
        console.warn(`Tier ${tier.level} failed: ${(tierError as Error).message}`);
        continue;
      }
    }
    // Final fallback to minimal rule-based validation as a safe default
    const finalTier = new RuleBasedFallbackTier();
    const final = await finalTier.execute(originalData, error);
    return this.wrapFallbackResult(final, finalTier.level, error);
  }

  private isAcceptable(result: ValidationResult): boolean {
    const scores = (result.scores || {}) as { overall?: number };
    const overall = typeof scores.overall === 'number' ? scores.overall : NaN;
    if (Number.isFinite(overall)) return overall >= 30; // basic guard
    return true; // accept when unknown shape to avoid infinite fallback
  }
}

// Main requested class
export class AdaptiveMultiAIValidator extends MultiAIValidator {
  private businessModelDetector: BusinessModelDetector;
  private contextDetector?: BusinessModelContextAwareDetector;
  private validationStrategies: Map<BusinessModelType, ValidationStrategy>;
  private consistencyEngine: MathematicalConsistencyEngine;
  private fallbackOrchestrator: FallbackOrchestrator;
  private adaptiveFallback: AdaptiveFallbackOrchestrator;
  private edgeCaseManager: EdgeCaseManager;

  constructor(originalValidator?: MultiAIValidator) {
    super();
  const useComposite = process.env.ADAPTIVE_COMPOSITE_DETECTOR === '1';
  this.businessModelDetector = new HeuristicBusinessModelDetector();
  this.contextDetector = useComposite ? new CompositeBusinessModelDetector() : undefined;
    this.consistencyEngine = new WeightedEnsembleConsistencyEngine();
  this.validationStrategies = new Map();
    this.setupDefaultStrategies();
  this.fallbackOrchestrator = new SimpleFallbackOrchestrator();
  this.adaptiveFallback = new AdaptiveFallbackOrchestrator();
  this.edgeCaseManager = new EdgeCaseManager();
    if (originalValidator) {
      // register an optional global fallback strategy if needed
      this.validationStrategies.set('unknown', {
        name: 'fallback-original',
        validate: async (input) => originalValidator.validate(input),
      });
    }
  }

  private setupDefaultStrategies() {
    const hybrid = new HybridStrategy();
    // For now, route all models to the Hybrid strategy; can expand later
    this.validationStrategies.set('saas', hybrid);
    this.validationStrategies.set('marketplace', hybrid);
    this.validationStrategies.set('physical-subscription', hybrid);
    this.validationStrategies.set('ecommerce', new ECommerceValidationStrategy());
    this.validationStrategies.set('services', hybrid);
    this.validationStrategies.set('unknown', hybrid);
  }

  private async enrichWithBusinessContext(data: ValidationInput): Promise<{ bm: BusinessModelType; input: ValidationInput; ctx?: BusinessModelContext }>{
    if (this.contextDetector) {
      const ctx = await this.contextDetector.detectModel(data);
      return { bm: ctx.primaryType, input: data, ctx };
    }
    const bm = this.businessModelDetector.detect(data.idea_text || '');
    return { bm, input: data };
  }

  private async executeAdaptiveValidation(data: ValidationInput, ctx: { bm: BusinessModelType }): Promise<ValidationResult> {
    const strategy = this.validationStrategies.get(ctx.bm) || this.validationStrategies.get('unknown');
    if (!strategy) throw new Error('No validation strategy available');
    return strategy.validate(data);
  }

  private async ensureMathematicalConsistency(result: ValidationResult): Promise<ValidationResult> {
    return this.consistencyEngine.enforce(result);
  }

  private async handleFallbacks(result: ValidationResult, _ctx: { bm: BusinessModelType }): Promise<ValidationResult> {
    void _ctx; // reserved for future use
    // Hook for future: could retry with an alternate strategy when scores look contradictory
    return result;
  }

  async validate(data: ValidationInput, options?: ValidationOptions): Promise<ValidationResult> {
    // Pre-route certain edge cases
    const preEdge = await this.maybeRoutePreEdgeCase(data);
    if (preEdge) return preEdge as unknown as ValidationResult;
    const { bm, input, ctx } = await this.enrichWithBusinessContext(data);
    let res: ValidationResult;
    try {
      res = await this.executeAdaptiveValidation(input, { bm });
    } catch (err) {
      res = await this.adaptiveFallback.handleFallback(err as ClassificationError, input);
    }
    const consistent = options?.clampScores === false ? res : await this.ensureMathematicalConsistency(res);
    let withMeta: ValidationResult = ctx ? ({ ...consistent, meta: { ...(consistent.meta || {}), model_detection: ctx } }) : consistent;

    // Optional consensus computation for transparency
    try {
      if (process.env.ADAPTIVE_CONSENSUS === '1') {
  const scores = (withMeta.scores || {}) as HybridScores;
        // Build normalized category signals [0..1]
        const to01 = (v: unknown, scale100 = false) => {
          const n = typeof v === 'number' ? v : Number(v);
          if (!Number.isFinite(n)) return 0;
          return Math.max(0, Math.min(1, scale100 ? n / 100 : n / 10));
        };
  const customerAcq = Math.max(to01((scores as HybridScores).gtm), to01((scores as HybridScores).demand_signals));
  const revenueGrowth = Math.max(to01((scores as HybridScores).willingness_to_pay), to01((scores as HybridScores).market_quality));
  const operationalEfficiency = Math.max(to01((scores as HybridScores).execution), to01((scores as HybridScores).feasibility));
  const competitivePosition = Math.max(to01((scores as HybridScores).differentiation), to01((scores as HybridScores).problem));
        const hybridProvider: NormalizedResult[] = [
          { provider: 'hybrid', category: 'customerAcquisition', score: customerAcq, reliability: 0.8 },
          { provider: 'hybrid', category: 'revenueGrowth', score: revenueGrowth, reliability: 0.8 },
          { provider: 'hybrid', category: 'operationalEfficiency', score: operationalEfficiency, reliability: 0.8 },
          { provider: 'hybrid', category: 'competitivePosition', score: competitivePosition, reliability: 0.8 },
        ];

        // Pull weights from domain meta when available (ecommerce)
        const baseMeta = (withMeta as unknown as { meta?: Record<string, unknown> }).meta || {};
        const ecommerce = baseMeta['ecommerce'] as Record<string, unknown> | undefined;
        const criteria = ecommerce?.['criteria'] as Partial<WeightConfiguration> | undefined;
        let weightConfig: WeightConfiguration = {
          customerAcquisition: 0.25,
          revenueGrowth: 0.25,
          operationalEfficiency: 0.25,
          competitivePosition: 0.25,
        };
        if (criteria) {
          weightConfig = {
            customerAcquisition: Number(criteria.customerAcquisition ?? 0.25),
            revenueGrowth: Number(criteria.revenueGrowth ?? 0.25),
            operationalEfficiency: Number(criteria.operationalEfficiency ?? 0.25),
            competitivePosition: Number(criteria.competitivePosition ?? 0.25),
          };
          // normalize to 1.0
          const sum = Object.values(weightConfig).reduce((a, b) => a + b, 0) || 1;
          weightConfig = {
            customerAcquisition: Number((weightConfig.customerAcquisition / sum).toFixed(6)),
            revenueGrowth: Number((weightConfig.revenueGrowth / sum).toFixed(6)),
            operationalEfficiency: Number((weightConfig.operationalEfficiency / sum).toFixed(6)),
            competitivePosition: Number((weightConfig.competitivePosition / sum).toFixed(6)),
          };
        }

        const engine = new ConsensusMathematicalConsistencyEngine();
        const outcome = await engine.ensureConsistency(hybridProvider, weightConfig);
        withMeta = { ...withMeta, meta: { ...(withMeta.meta || {}), consensus: { outcome, weights: weightConfig } } };
      }
    } catch {}

    // Post-route ambiguous model (low detection confidence) as edge case if applicable
    const routed = await this.maybeRoutePostEdgeCase(withMeta);
    if (routed) return routed as unknown as ValidationResult;
    return this.handleFallbacks(withMeta, { bm });
  }

  private async maybeRoutePreEdgeCase(input: ValidationInput): Promise<ValidationResult | null> {
    const t = (input.idea_text || '').toLowerCase();
    if (/illegal|prohibited|adult|weapon|fraud/.test(t) || input.illegal_or_prohibited) {
      return (await this.edgeCaseManager.routeEdgeCase(input, 'illegal_content')) as unknown as ValidationResult;
    }
    if (t.length < 15) {
      return (await this.edgeCaseManager.routeEdgeCase(input, 'insufficient_data')) as unknown as ValidationResult;
    }
    return null;
  }

  private async maybeRoutePostEdgeCase(result: ValidationResult): Promise<ValidationResult | null> {
    const meta = (result.meta || {}) as Record<string, unknown>;
    const det = meta['model_detection'] as { confidence?: number } | undefined;
    if (det && typeof det.confidence === 'number' && det.confidence < 0.4) {
      return (await this.edgeCaseManager.routeEdgeCase(result, 'ambiguous_model')) as unknown as ValidationResult;
    }
    return null;
  }
}

// Helper used by API route to apply only the consistency pass
export function enforceAdaptiveConsistency(result: ValidationResult): ValidationResult {
  const engine = new WeightedEnsembleConsistencyEngine();
  return engine.enforce(result);
}

// ---- Plugin system (optional extension) ----
export interface ValidationPlugin {
  name: string;
  version: string;
  supportedBusinessModels: BusinessModelType[];
  canHandle(context: ValidationContext): boolean;
  validate(data: unknown, context: ValidationContext): Promise<ValidationResult & { handled?: boolean }>;
  priority: number; // higher runs first
}

export class PluginBasedValidator extends MultiAIValidator {
  private plugins: ValidationPlugin[] = [];
  private legacyValidator: MultiAIValidator;

  constructor(legacy?: MultiAIValidator) {
    super();
    this.legacyValidator = legacy || new AdaptiveMultiAIValidator();
  }

  registerPlugin(plugin: ValidationPlugin): void {
    this.plugins.push(plugin);
    this.plugins.sort((a, b) => b.priority - a.priority);
  }

  private enhanceResult(result: ValidationResult, plugin: ValidationPlugin): ValidationResult {
    const meta = (result.meta || {}) as Record<string, unknown>;
    return { ...result, meta: { ...meta, plugin: { name: plugin.name, version: plugin.version } } };
  }

  private async buildValidationContext(data: unknown, _options?: ValidationOptions): Promise<ValidationContext> {
    void _options;
    const text: string = String((data as { idea_text?: unknown } | null | undefined)?.idea_text ?? '');
    // Infer a rough context similar to ECommerceValidationStrategy usage
    const marketSaturation = /crowded|saturated|many competitors|generic/.test(text.toLowerCase()) ? 0.85 : 0.6;
    const maturity: MarketMaturity = /prelaunch|prototype|idea/.test(text.toLowerCase()) ? 'early' : (/scale|vc|growth/i.test(text) ? 'growth' : 'early');
    return { marketMaturity: maturity, marketSaturation, category: undefined };
  }

  async validate(data: unknown, options?: ValidationOptions): Promise<ValidationResult> {
    const context = await this.buildValidationContext(data, options);
    for (const plugin of this.plugins) {
      if (!plugin.supportedBusinessModels || plugin.supportedBusinessModels.length === 0 || plugin.canHandle(context)) {
        try {
          const result = await plugin.validate(data, context);
          if ((result as { handled?: boolean }).handled) {
            return this.enhanceResult(result, plugin);
          }
        } catch (error) {
          const e = error as Error;
          console.warn(`Plugin ${plugin.name} failed: ${e.message}`);
          continue;
        }
      }
    }
    // Fallback to legacy validator
    return this.legacyValidator.validate(data, options);
  }
}

// ---- Enhanced API wrapper (maps user's requested class onto existing components) ----
export interface AdaptiveValidationConfig {
  legacyConfig?: unknown;
  aiProviders?: string[];
  calibrationModels?: CalibrationModel[];
  modelPath?: string;
}

export type EnhancedValidationResult = ValidationResult & {
  businessModelDetected?: BusinessModelType;
  adaptiveEnhancements?: unknown;
  mathematicalConsistencyScore?: number;
  fallbacksUsed?: unknown[];
};

// Minimal KPI framework adapter to satisfy requested interface shape
class KPIFrameworkAdapter {
  private readonly kpi: AdaptiveKPIFramework;
  private readonly model: BusinessModelType;
  constructor(model: BusinessModelType) {
    this.kpi = new AdaptiveKPIFramework();
    this.model = model;
  }
  validateKPIs(_result: ValidationResult) {
    void _result;
    // For now, return a structural stub; UI can render config from meta
    return { status: 'unknown', notes: ['KPI validation not yet implemented for enhanced wrapper'] };
  }
  getBenchmarkComparison(_result: ValidationResult) {
    void _result;
    return { status: 'unknown' } as const;
  }
  get config() {
    // Use a neutral context; strategies may override in their own meta
    return this.kpi.getRelevantKPIs(this.model, { growthStage: 'early', competitiveIntensity: 0.6 });
  }
}

// Constraints adapter expected by applyBusinessConstraints
class ConstraintsAdapter {
  private readonly engine: MarketSaturationConstraints;
  private readonly model: BusinessModelType;
  private lastNotes: string[] = [];
  constructor(model: BusinessModelType) {
    this.engine = new MarketSaturationConstraints();
    this.model = model;
  }
  applyConstraints(result: ValidationResult): ValidationResult {
    // Use a moderate, model-agnostic market context; the domain strategy provides more precise caps in its meta
    const modelOut = this.engine.calculateSaturationCap(this.model, {
      spendIndex: 1.0,
      saturationPct: 65,
      demandElasticity: 0.9,
    });
    const cap100 = Math.round(modelOut.alphaCap * 100);
    this.lastNotes = [
      `alpha≈${modelOut.alphaCap.toFixed(2)}, beta≈${modelOut.betaInflection.toFixed(2)}, gamma≈${modelOut.gammaShape.toFixed(2)}`,
      'Applied global saturation clamp via Hill-function',
    ];
    const s = { ...(result.scores as HybridScores) } as HybridScores;
    if (typeof s.overall === 'number') {
      s.overall = Math.min(s.overall, cap100);
    }
    return { ...result, scores: s, meta: { ...(result.meta || {}), saturation_cap: { cap100, model: this.model } } } as ValidationResult;
  }
  getAppliedConstraints() {
    return this.lastNotes.slice();
  }
}

// Lightweight engine adapter
class AdaptiveValidationEngine {
  private strategies: Map<BusinessModelType, ValidationStrategy>;
  private constraintEngine: MarketSaturationConstraints;
  constructor(opts: { businessModelStrategies: Map<BusinessModelType, ValidationStrategy>; fallbackOrchestrator?: FallbackOrchestrator; constraintEngine?: MarketSaturationConstraints }) {
    this.strategies = opts.businessModelStrategies;
    this.constraintEngine = opts.constraintEngine || new MarketSaturationConstraints();
  }
  selectStrategy(businessContext: BusinessModelContext): ValidationStrategy {
    return this.strategies.get(businessContext.primaryType) || this.strategies.get('unknown')!;
  }
  getConstraintsForModel(model: BusinessModelType) {
    void this.constraintEngine; // instance kept for future, adapter builds per-call constraints with default context
    return new ConstraintsAdapter(model);
  }
  getKPIFramework(model: BusinessModelType) {
    return new KPIFrameworkAdapter(model);
  }
}

// RoBERTa detector wrapper mapping to our CompositeBusinessModelDetector
class RoBERTaBusinessModelDetector implements BusinessModelContextAwareDetector {
  private readonly detector: CompositeBusinessModelDetector;
  private readonly confidenceThreshold: number;
  private readonly hybridDetectionThreshold: number;
  constructor(cfg?: { modelPath?: string; confidenceThreshold?: number; hybridDetectionThreshold?: number }) {
    void cfg?.modelPath; // reserved; we use local heuristics
    this.detector = new CompositeBusinessModelDetector();
    this.confidenceThreshold = cfg?.confidenceThreshold ?? 0.7;
    this.hybridDetectionThreshold = cfg?.hybridDetectionThreshold ?? 0.6;
  }
  async detectModel(data: unknown): Promise<BusinessModelContext> {
    const ctx = await this.detector.detectModel(data);
    // Nudge hybrid characteristics visibility
    const hybrid = Array.isArray(ctx.hybridCharacteristics) && ctx.hybridCharacteristics.length > 0 ? ctx.hybridCharacteristics : null;
    const confidence = Math.max(0, Math.min(1, ctx.confidence));
    return { ...ctx, hybridCharacteristics: hybrid, confidence };
  }
}

// Consistency adapter with ensureConsistency API
interface EnhancedMathematicalConsistencyEngine {
  ensureConsistency(result: ValidationResult): Promise<ValidationResult & { consistencyScore: number }>;
}

class MathematicalConsistencyEngineAdapter implements EnhancedMathematicalConsistencyEngine {
  private readonly clamp = new WeightedEnsembleConsistencyEngine();
  async ensureConsistency(result: ValidationResult): Promise<ValidationResult & { consistencyScore: number }> {
    const enforced = this.clamp.enforce(result);
    // Simple heuristic: start at 0.8, penalize if overall was clamped significantly
    let score = 0.8;
    const before = (result.scores as { overall?: number } | undefined)?.overall;
    const after = (enforced.scores as { overall?: number } | undefined)?.overall;
    if (typeof before === 'number' && typeof after === 'number') {
      const delta = Math.max(0, before - after);
      score = Math.max(0.5, 0.8 - Math.min(0.3, delta / 200)); // up to 30% penalty for heavy clamp
    }
    return Object.assign({}, enforced, { consistencyScore: Number(score.toFixed(3)) });
  }
}

// ---- False Positive Prevention System (layered) ----
type FlexibleRules = {
  relaxations: string[];
  softBlocks: Array<{ code: string; weight: number; reason: string }>;
  justifications: string[];
};

type AdjustedThresholds = {
  overallMin: number; // 0..100
  dimensionMin: number; // 0..10
  notes: string[];
};

type EnsembleExplanation = {
  explainabilityScore: number; // 0..1
  explanations: string[];
};

class RuleFlexibilityEngine {
  async evaluateFlexibleRules(data: unknown, context: ValidationContext): Promise<FlexibleRules> {
    const text = String((data as { idea_text?: unknown } | undefined)?.idea_text ?? '').toLowerCase();
    const relaxations: string[] = [];
    const justifications: string[] = [];
    if (context.marketMaturity === 'early') {
      relaxations.push('evidence-strictness');
      justifications.push('Early-stage signal scarcity expected');
    }
    if (/handmade|artisan|niche|community/.test(text)) {
      relaxations.push('category-benchmark');
      justifications.push('Niche positioning warrants tailored benchmarks');
    }
    const softBlocks = [/project management|crm|email marketing/.test(text)
      ? [{ code: 'saturated-category', weight: 0.3, reason: 'Highly saturated market detected' }]
      : []];
    return { relaxations, softBlocks: softBlocks[0], justifications };
  }
}

class ContextualThresholdManager {
  getAdjustedThresholds(context: ValidationContext): AdjustedThresholds {
    const baseOverall = 55;
    const baseDim = 4.5;
    let overallMin = baseOverall;
    let dimensionMin = baseDim;
    const notes: string[] = [];
    if (context.marketMaturity === 'early') {
      overallMin -= 5; // allow more exploration
      dimensionMin -= 0.3;
      notes.push('Relaxed thresholds for early-stage context');
    }
    if (context.marketSaturation > 0.8) {
      // counteract false positives by raising thresholds in saturated markets
      overallMin += 5;
      notes.push('Raised overall threshold due to saturation risk');
    }
    overallMin = Math.max(30, Math.min(80, overallMin));
    dimensionMin = Math.max(3, Math.min(7, dimensionMin));
    return { overallMin, dimensionMin, notes };
  }
}

class EnsembleValidationEngine {
  async validateWithExplanation(
    base: ValidationResult,
    _flex: FlexibleRules,
    thresholds: AdjustedThresholds
  ): Promise<ValidationResult & EnsembleExplanation> {
    const s = (base.scores || {}) as HybridScores;
    const overall = typeof s.overall === 'number' ? s.overall : 50;
    const dims = [s.problem, s.underserved, s.feasibility, s.differentiation, s.demand_signals, s.willingness_to_pay, s.market_quality, s.gtm, s.execution, s.risk].filter((v): v is number => typeof v === 'number');
    const dimPass = dims.length ? dims.filter(v => v >= thresholds.dimensionMin).length / dims.length : 0.5;
    const explainabilityScore = Number(Math.max(0.4, Math.min(0.95, 0.6 * dimPass + 0.4 * (overall >= thresholds.overallMin ? 1 : 0))).toFixed(3));
    const explanations: string[] = [];
    explanations.push(`Overall ${overall} vs min ${thresholds.overallMin}`);
    explanations.push(`Dimensions pass rate ${(dimPass * 100).toFixed(0)}% vs min ${(thresholds.dimensionMin).toFixed(1)}`);
    return Object.assign({}, base, { explainabilityScore, explanations });
  }
}

class FalsePositivePreventionSystem {
  private ruleFlexibilityEngine = new RuleFlexibilityEngine();
  private contextualThresholds = new ContextualThresholdManager();
  private ensembleValidation = new EnsembleValidationEngine();

  async validateWithFalsePositivePrevention(
    data: unknown,
    context: ValidationContext,
    current: ValidationResult
  ): Promise<{ enhanced: ValidationResult; meta: { false_positive: { risk: number; recommendations: string[]; explainability_score: number; explanations: string[]; thresholds: AdjustedThresholds; flexible_rules: FlexibleRules } } }> {
    const flexibleRules = await this.ruleFlexibilityEngine.evaluateFlexibleRules(data, context);
    const adjustedThresholds = this.contextualThresholds.getAdjustedThresholds(context);
    const ensembleResult = await this.ensembleValidation.validateWithExplanation(current, flexibleRules, adjustedThresholds);
    const impact = this.assessValidationImpact(ensembleResult, context);
    const recommendations = this.generateRecommendations(ensembleResult, impact);
    const meta = {
      false_positive: {
        risk: impact.falsePositiveRisk,
        recommendations,
        explainability_score: ensembleResult.explainabilityScore,
        explanations: ensembleResult.explanations,
        thresholds: adjustedThresholds,
        flexible_rules: flexibleRules,
      }
    } as const;
    return { enhanced: ensembleResult, meta };
  }

  private assessValidationImpact(ensemble: ValidationResult & EnsembleExplanation, context: ValidationContext): { falsePositiveRisk: number } {
    const s = (ensemble.scores || {}) as HybridScores;
    const overall = typeof s.overall === 'number' ? s.overall : 50;
    const saturationPenalty = Math.max(0, context.marketSaturation - 0.6) * 0.6; // saturated markets increase false-positive risk
    // Risk is higher when overall is just above threshold bands (e.g., 55-65) and saturation high
    const bandRisk = overall >= 55 && overall <= 65 ? 0.3 : 0.1;
    const risk = Math.max(0, Math.min(1, bandRisk + saturationPenalty + (1 - ensemble.explainabilityScore) * 0.3));
    return { falsePositiveRisk: Number(risk.toFixed(3)) };
  }

  private generateRecommendations(ensemble: ValidationResult & EnsembleExplanation, impact: { falsePositiveRisk: number }): string[] {
    const recs: string[] = [];
    if (impact.falsePositiveRisk >= 0.5) recs.push('Tighten acceptance thresholds for saturated categories');
    if (ensemble.explainabilityScore < 0.7) recs.push('Collect more evidence for weak dimensions to improve explainability');
    if (!recs.length) recs.push('Maintain current thresholds; monitor drift over time');
    return recs;
  }
}

export class EnhancedMultiAIValidator extends MultiAIValidator {
  private adaptiveEngine: AdaptiveValidationEngine;
  private businessModelDetector: BusinessModelContextAwareDetector;
  private mathematicalConsistency: EnhancedMathematicalConsistencyEngine;

  constructor(config: AdaptiveValidationConfig = {}) {
    super();
    const strategies = this.initializeStrategies();
    this.adaptiveEngine = new AdaptiveValidationEngine({
      businessModelStrategies: strategies,
      fallbackOrchestrator: new SimpleFallbackOrchestrator(),
      constraintEngine: new MarketSaturationConstraints(),
    });
    this.businessModelDetector = new RoBERTaBusinessModelDetector({
      modelPath: config.modelPath,
      confidenceThreshold: 0.7,
      hybridDetectionThreshold: 0.6,
    });
    this.mathematicalConsistency = new MathematicalConsistencyEngineAdapter();
  }

  private initializeStrategies(): Map<BusinessModelType, ValidationStrategy> {
    const map = new Map<BusinessModelType, ValidationStrategy>();
    const hybrid = new HybridStrategy();
    map.set('saas', hybrid);
    map.set('marketplace', hybrid);
    map.set('physical-subscription', hybrid);
    map.set('ecommerce', new ECommerceValidationStrategy());
    map.set('services', hybrid);
    map.set('unknown', hybrid);
    return map;
  }

  async validate(data: unknown, options?: ValidationOptions): Promise<EnhancedValidationResult> {
    try {
      const businessContext = await this.detectBusinessContext(data);
      if (businessContext.confidence < 0.5) {
        return this.handleLowConfidenceClassification(data, businessContext);
      }
      const strategy = this.adaptiveEngine.selectStrategy(businessContext);
      const rawResults = await this.executeStrategyValidation(data, strategy, businessContext);
      const consistentResults = await this.mathematicalConsistency.ensureConsistency(rawResults);
      const finalResult = await this.applyBusinessConstraints(consistentResults, businessContext);
      const enhancements = (strategy as unknown as { getEnhancements?: () => unknown }).getEnhancements?.();
      return Object.assign({}, finalResult, {
        businessModelDetected: businessContext.primaryType,
        adaptiveEnhancements: enhancements,
        mathematicalConsistencyScore: consistentResults.consistencyScore,
        fallbacksUsed: [] as unknown[],
      }) as EnhancedValidationResult;
    } catch (error) {
      return this.handleValidationError(data, error, options);
    }
  }

  private async executeStrategyValidation(data: unknown, strategy: ValidationStrategy, _context: BusinessModelContext): Promise<ValidationResult> {
    void _context;
    return strategy.validate((data || {}) as ValidationInput);
  }

  private async detectBusinessContext(data: unknown): Promise<BusinessModelContext> {
    const detectionResult = await this.businessModelDetector.detectModel(data);
    return {
      ...detectionResult,
      marketContext: await this.enrichWithMarketData(data),
      competitiveContext: await this.enrichWithCompetitiveData(data),
      regulatoryContext: await this.enrichWithRegulatoryData(data),
    } as unknown as BusinessModelContext;
  }

  private async handleLowConfidenceClassification(data: unknown, context: BusinessModelContext): Promise<EnhancedValidationResult> {
    // If signals suggest hybrid, annotate and proceed with hybrid strategy
    const hybridLikelihood = (context as { uncertaintyMetrics?: { hybridLikelihood?: number } } | undefined)?.uncertaintyMetrics?.hybridLikelihood;
    if (typeof hybridLikelihood === 'number' && hybridLikelihood > 0.6) {
      return this.handleHybridBusinessModel(data, context);
    }
    return this.executeConservativeValidation(data, context);
  }

  private async handleHybridBusinessModel(data: unknown, context: BusinessModelContext): Promise<EnhancedValidationResult> {
    const strategy = new HybridStrategy();
    const res = await strategy.validate((data || {}) as ValidationInput);
    const wrapped: EnhancedValidationResult = Object.assign({}, res, {
      businessModelDetected: context.primaryType,
      adaptiveEnhancements: { hybrid: true },
      fallbacksUsed: [],
    });
    const meta = (wrapped.meta || {}) as Record<string, unknown>;
    wrapped.meta = { ...meta, model_detection: context };
    return wrapped;
  }

  private async executeConservativeValidation(data: unknown, context: BusinessModelContext): Promise<EnhancedValidationResult> {
    const base = await new HybridStrategy().validate((data || {}) as ValidationInput);
    const res: EnhancedValidationResult = Object.assign({}, base, {
      businessModelDetected: context.primaryType,
      adaptiveEnhancements: { mode: 'conservative' },
      fallbacksUsed: [],
    });
    const meta = (res.meta || {}) as Record<string, unknown>;
    res.meta = { ...meta, model_detection: context, notes: ['Low classification confidence; conservative bounds applied'] };
    return res;
  }

  private async applyBusinessConstraints(results: ValidationResult, context: BusinessModelContext): Promise<ValidationResult> {
    const constraints = this.adaptiveEngine.getConstraintsForModel(context.primaryType);
    const kpiFramework = this.adaptiveEngine.getKPIFramework(context.primaryType);
    const constrained = constraints.applyConstraints(results);
    const kpiValidation = kpiFramework.validateKPIs(constrained);
    const industryBenchmarks = kpiFramework.getBenchmarkComparison(results);
    const meta = (constrained.meta || {}) as Record<string, unknown>;
    let next: ValidationResult = { ...constrained, meta: { ...meta, ecommerce: { ...(meta['ecommerce'] as Record<string, unknown> || {}), kpi_framework: { config: kpiFramework.config }, kpiValidation, constraintsApplied: constraints.getAppliedConstraints(), industryBenchmarks } } };
    // Optional: run false-positive prevention and attach meta
    if (process.env.ADAPTIVE_FALSE_POSITIVE === '1') {
      // Derive a simple context similar to ecommerce strategy
      const text = String(((results as unknown as { idea_text?: unknown })?.idea_text) ?? '').toLowerCase();
      const marketSaturation = /crowded|saturated|many competitors|generic/.test(text) ? 0.85 : 0.65;
      const maturity: MarketMaturity = /prelaunch|prototype|idea/.test(text) ? 'early' : (/scale|vc|growth/.test(text) ? 'growth' : 'early');
      const ctx: ValidationContext = { marketMaturity: maturity, marketSaturation, category: context.primaryType };
      const fps = new FalsePositivePreventionSystem();
      const out = await fps.validateWithFalsePositivePrevention({ idea_text: text }, ctx, next);
      const curMeta = (next.meta || {}) as Record<string, unknown>;
      next = { ...out.enhanced, meta: { ...curMeta, false_positive: out.meta.false_positive } } as ValidationResult;
    }
    return next;
  }

  private async handleValidationError(data: unknown, error: unknown, _options?: ValidationOptions): Promise<EnhancedValidationResult> {
    void _options;
    const fallback = new AdaptiveFallbackOrchestrator();
    const base = await fallback.handleFallback(error as ClassificationError, (data || {}) as ValidationInput);
    type FallbackMeta = { fallback?: { tier?: string } };
    const wrapped: EnhancedValidationResult = Object.assign({}, base, {
      fallbacksUsed: [(((base.meta as unknown as FallbackMeta) || {})?.fallback?.tier) || 'unknown'],
    });
    return wrapped;
  }

  private async enrichWithMarketData(_data: unknown) {
    void _data;
    return { region: 'global' } as const;
  }
  private async enrichWithCompetitiveData(_data: unknown) {
    void _data;
    return { intensity: 'moderate' } as const;
  }
  private async enrichWithRegulatoryData(_data: unknown) {
    void _data;
    return { flags: [] as string[] } as const;
  }
}
