// src/lib/kpiFramework.ts
// Adaptive KPI framework with repositories per business model.

import type { BusinessModelType } from '@/lib/adaptiveMultiAIValidator';

export type GrowthStage = 'early' | 'growth' | 'mature';

export interface MarketContext {
  growthStage: GrowthStage;
  competitiveIntensity: number; // 0..1
  avgOrderValue?: number;
  churnRate?: number;
}

export interface KPIWeights {
  growthMetrics: number;
  profitabilityMetrics: number;
  differentiationMetrics: number;
  costEfficiencyMetrics: number;
}

export interface KPIConfiguration {
  primaryKPIs: string[];
  secondaryKPIs: string[];
  adaptiveWeights: KPIWeights;
  benchmarkTargets: Record<string, number | string>;
  validationThresholds: Record<string, number>;
}

export interface KPIRepository {
  getPrimaryKPIs(ctx: MarketContext): string[];
  getSecondaryKPIs(ctx: MarketContext): string[];
  getBenchmarkTargets(ctx: MarketContext): Record<string, number | string>;
  getValidationThresholds(): Record<string, number>;
}

class ECommerceKPIRepository implements KPIRepository {
  getPrimaryKPIs(ctx: MarketContext): string[] {
    const base = ['conversion_rate', 'cac', 'ltv_cac', 'repeat_rate'];
    return ctx.growthStage === 'early' ? ['conversion_rate', 'cac', 'repeat_rate'] : base;
  }
  getSecondaryKPIs(ctx: MarketContext): string[] {
    const base = ['aov', 'ltv', 'refund_rate', 'return_rate'];
    return ctx.competitiveIntensity > 0.8 ? [...base, 'brand_search_share'] : base;
  }
  getBenchmarkTargets(ctx: MarketContext): Record<string, number | string> {
    return {
      conversion_rate: ctx.growthStage === 'early' ? '1.5%-2.5%' : '2%-3%+',
      cac: ctx.competitiveIntensity > 0.8 ? '< $60' : '< $40',
      ltv_cac: ctx.growthStage === 'mature' ? '> 3.0' : '> 2.0',
      repeat_rate: ctx.growthStage === 'early' ? '> 15%' : '> 25%'
    };
  }
  getValidationThresholds(): Record<string, number> {
    return { conversion_rate: 1.5, ltv_cac: 1.5, repeat_rate: 10 };
  }
}

export class AdaptiveKPIFramework {
  private kpiRepositories: Map<BusinessModelType, KPIRepository> = new Map();

  constructor() {
    this.kpiRepositories.set('ecommerce', new ECommerceKPIRepository());
  }

  getRelevantKPIs(businessModel: BusinessModelType, marketContext: MarketContext): KPIConfiguration {
    const repository = this.kpiRepositories.get(businessModel);
    if (!repository) {
      // Default minimal config
      const defaults: KPIWeights = this.normalizeWeights({
        growthMetrics: 0.3, profitabilityMetrics: 0.3, differentiationMetrics: 0.2, costEfficiencyMetrics: 0.2
      });
      return {
        primaryKPIs: ['overall_score'],
        secondaryKPIs: [],
        adaptiveWeights: defaults,
        benchmarkTargets: {},
        validationThresholds: { overall_score: 50 }
      };
    }
    return {
      primaryKPIs: repository.getPrimaryKPIs(marketContext),
      secondaryKPIs: repository.getSecondaryKPIs(marketContext),
      adaptiveWeights: this.calculateKPIWeights(businessModel, marketContext),
      benchmarkTargets: repository.getBenchmarkTargets(marketContext),
      validationThresholds: repository.getValidationThresholds()
    };
  }

  private calculateKPIWeights(businessModel: BusinessModelType, context: MarketContext): KPIWeights {
    const baseWeights = this.getBaseWeightsForModel(businessModel);
    if (context.growthStage === 'early') {
      baseWeights.growthMetrics *= 1.3;
      baseWeights.profitabilityMetrics *= 0.7;
    }
    if (context.competitiveIntensity > 0.8) {
      baseWeights.differentiationMetrics *= 1.2;
      baseWeights.costEfficiencyMetrics *= 1.1;
    }
    return this.normalizeWeights(baseWeights);
  }

  private getBaseWeightsForModel(model: BusinessModelType): KPIWeights {
    switch (model) {
      case 'ecommerce':
        return { growthMetrics: 0.35, profitabilityMetrics: 0.25, differentiationMetrics: 0.25, costEfficiencyMetrics: 0.15 };
      case 'marketplace':
        return { growthMetrics: 0.4, profitabilityMetrics: 0.2, differentiationMetrics: 0.25, costEfficiencyMetrics: 0.15 };
      case 'physical-subscription':
        return { growthMetrics: 0.3, profitabilityMetrics: 0.3, differentiationMetrics: 0.2, costEfficiencyMetrics: 0.2 };
      case 'saas':
        return { growthMetrics: 0.3, profitabilityMetrics: 0.25, differentiationMetrics: 0.25, costEfficiencyMetrics: 0.2 };
      default:
        return { growthMetrics: 0.3, profitabilityMetrics: 0.3, differentiationMetrics: 0.2, costEfficiencyMetrics: 0.2 };
    }
  }

  private normalizeWeights(w: KPIWeights): KPIWeights {
    const sum = w.growthMetrics + w.profitabilityMetrics + w.differentiationMetrics + w.costEfficiencyMetrics;
    if (sum === 0) return { growthMetrics: 0.25, profitabilityMetrics: 0.25, differentiationMetrics: 0.25, costEfficiencyMetrics: 0.25 };
    return {
      growthMetrics: Number((w.growthMetrics / sum).toFixed(3)),
      profitabilityMetrics: Number((w.profitabilityMetrics / sum).toFixed(3)),
      differentiationMetrics: Number((w.differentiationMetrics / sum).toFixed(3)),
      costEfficiencyMetrics: Number((w.costEfficiencyMetrics / sum).toFixed(3))
    };
  }
}
