// src/lib/marketSaturation.ts
// Market saturation constraints modeled via a Hill function per business model type.

import type { BusinessModelType } from '@/lib/adaptiveMultiAIValidator';

export interface MarketContext {
  spendIndex: number; // normalized marketing spend index (0..inf)
  saturationPct: number; // observed saturation 0..100
  demandElasticity?: number; // optional modifier (0..1 lower = less responsive)
}

export interface SaturationParameters { alpha: number; beta: number; gamma: number }

export interface SaturationModel {
  alphaCap: number; // theoretical max response at infinite spend (0..1)
  betaInflection: number; // inflection spend index
  gammaShape: number; // curve steepness
  constraintFunction: (spendIndex: number) => number; // response in 0..1
}

export class MarketSaturationConstraints {
  calculateSaturationCap(businessModel: BusinessModelType, marketData: MarketContext): SaturationModel {
    const parameters = this.getParametersForModel(businessModel);
    return {
      alphaCap: this.calculateMaxResponse(marketData, parameters),
      betaInflection: this.calculateInflectionPoint(marketData),
      gammaShape: this.calculateSaturationRate(businessModel),
      constraintFunction: (spend) => {
        const alpha = parameters.alpha;
        const beta = parameters.beta;
        const gamma = parameters.gamma;
        // Hill function: alpha * spend^gamma / (beta^gamma + spend^gamma)
        const num = alpha * Math.pow(spend, gamma);
        const den = Math.pow(beta, gamma) + Math.pow(spend, gamma);
        const v = den === 0 ? 0 : num / den;
        return Math.max(0, Math.min(1, v));
      }
    };
  }

  private getParametersForModel(businessModel: BusinessModelType): SaturationParameters {
    // Map string union BusinessModelType to parameters
    const modelParameters: Record<BusinessModelType, SaturationParameters> = {
      'saas': { alpha: 1.2, beta: 0.8, gamma: 2.1 },
      'marketplace': { alpha: 1.5, beta: 1.2, gamma: 1.8 },
      'ecommerce': { alpha: 1.1, beta: 0.6, gamma: 2.3 },
      'services': { alpha: 0.95, beta: 0.9, gamma: 1.7 },
      'physical-subscription': { alpha: 1.05, beta: 0.7, gamma: 2.0 },
      'unknown': { alpha: 1.0, beta: 1.0, gamma: 2.0 }
    };
    return modelParameters[businessModel] || { alpha: 1.0, beta: 1.0, gamma: 2.0 };
  }

  private calculateMaxResponse(marketData: MarketContext, params: SaturationParameters): number {
    const elasticity = typeof marketData.demandElasticity === 'number' ? Math.max(0.3, Math.min(1, marketData.demandElasticity)) : 1;
    const sat = Math.max(0, Math.min(100, marketData.saturationPct));
    const saturationPenalty = sat >= 95 ? 0.5 : sat >= 90 ? 0.65 : sat >= 80 ? 0.8 : 1;
    // Cap scales down with high saturation and low elasticity
    return Math.max(0.3, Math.min(1, params.alpha * elasticity * saturationPenalty));
  }

  private calculateInflectionPoint(marketData: MarketContext): number {
    // Use spendIndex and saturation to adjust beta inflection: more saturated -> higher beta
    const base = 1.0;
    const sat = Math.max(0, Math.min(100, marketData.saturationPct));
    const adj = sat >= 90 ? 1.4 : sat >= 80 ? 1.2 : 1.0;
    return Number(((base * adj) + (marketData.spendIndex > 1 ? 0.1 : 0)).toFixed(3));
  }

  private calculateSaturationRate(businessModel: BusinessModelType): number {
    // Slightly steeper for ecommerce and physical subs due to paid channel dynamics
    switch (businessModel) {
      case 'ecommerce': return 2.3;
      case 'physical-subscription': return 2.1;
      case 'marketplace': return 1.8;
      case 'services': return 1.7;
      case 'saas': return 2.0;
      default: return 2.0;
    }
  }
}

const MARKET_SATURATION_DB: Record<string, {
  saturation: number;
  majorCompetitors: string[];
  typicalCAC: number;
  reasoning: string;
}> = {
  "project management": {
    saturation: 95,
    majorCompetitors: ["Asana", "Monday.com", "Notion", "Trello", "ClickUp"],
    typicalCAC: 1200,
    reasoning: "Dominated by billion-dollar incumbents with free alternatives",
  },
  crm: {
    saturation: 90,
    majorCompetitors: ["Salesforce", "HubSpot", "Pipedrive"],
    typicalCAC: 800,
    reasoning: "Mature market with established enterprise relationships",
  },
  "email marketing": {
    saturation: 85,
    majorCompetitors: ["Mailchimp", "Constant Contact", "SendGrid"],
    typicalCAC: 300,
    reasoning: "Commoditized with strong network effects",
  },
};

function extractKeywords(idea: string): string[] {
  return (idea || "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter(Boolean);
}

type MarketKey = keyof typeof MARKET_SATURATION_DB;
type BestMatch = { market: MarketKey; score: number } | null;

function findMarketMatch(keywords: string[], db: typeof MARKET_SATURATION_DB): MarketKey | null {
  const keywordSet = new Set(keywords);
  let bestMatch: BestMatch = null;

  const markets = Object.keys(db) as MarketKey[];
  for (const market of markets) {
    const marketKeywords = String(market).split(/\s+/);
    let score = 0;
    for (const kw of marketKeywords) {
      if (keywordSet.has(kw)) score += 1;
    }
    if (score > 0 && (!bestMatch || score > bestMatch.score)) {
      bestMatch = { market, score };
    }
  }

  if (bestMatch) return bestMatch.market;
  return null;
}

export function assessMarketSaturation(
  businessIdea: string
):
  | {
      penalty: true;
      maxScore: number;
      reasoning: string;
      competitors: string[];
      recommendedCAC: number;
      saturation: number;
    }
  | { penalty: false } {
  const keywords = extractKeywords(businessIdea);
  const matchedMarketKey = findMarketMatch(keywords, MARKET_SATURATION_DB);
  if (matchedMarketKey) {
    const matchedMarket = MARKET_SATURATION_DB[matchedMarketKey];
    if (matchedMarket.saturation > 80) {
      return {
        penalty: true,
        maxScore: 25,
        reasoning: matchedMarket.reasoning,
        competitors: matchedMarket.majorCompetitors,
        recommendedCAC: matchedMarket.typicalCAC,
        saturation: matchedMarket.saturation,
      };
    }
  }
  return { penalty: false };
}

// no default export to avoid conflicts; import using named exports
