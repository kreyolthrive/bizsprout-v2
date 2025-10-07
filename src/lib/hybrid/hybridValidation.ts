// Hybrid Business Validation System
// Combines dynamic business classification with rigorous mathematical scoring

import { ValidationInput, ValidateResponse, Scores, QCRule, RedFlag } from './validation-types';

// ============================================================================
// BUSINESS DNA & DYNAMIC CLASSIFICATION
// ============================================================================

export interface BusinessDNA {
	industry: string;
	subIndustry: string;
	businessModel: string;
	customerType: 'b2c' | 'b2b' | 'b2b2c' | 'marketplace';
	stage: 'idea' | 'prototype' | 'mvp' | 'launched';
	scale: 'local' | 'regional' | 'national' | 'global';
	capitalIntensity: 'low' | 'medium' | 'high';
	regulatoryComplexity: 'low' | 'medium' | 'high';
	networkEffects: 'none' | 'weak' | 'strong';
	confidence: number;
}

export interface IndustryWeights {
	problem: number;
	underserved: number;
	feasibility: number;
	differentiation: number;
	demand_signals: number;
	wtp: number;
	market_quality: number;
	gtm: number;
	execution: number;
	risk: number;
	// Industry-specific additions
	network_effects?: number;
	regulatory_compliance?: number;
	supply_demand_balance?: number;
	viral_potential?: number;
}

export interface MarketIntelligence {
	tam_usd: number;
	growth_rate: number;
	competition_level: number; // 0-10, where 10 = low competition
	key_trends: string[];
	regulatory_barriers: string[];
	typical_margins: number;
	customer_acquisition_difficulty: number; // 0-10
	confidence: number;
	notable_competitors?: string[];
}

// Strategy representation for Layer 1 output
export interface ValidationStrategy {
	// Dimensions the system will score (display order is meaningful)
	selectedDimensions: Array<{
		key: keyof (ComputedScores & { willingness_to_pay: number });
		label: string;
		weight: number; // percentage of overall weighting (relative)
		reason: string;
	}>;
	benchmarksFocus: string[]; // which benchmarks matter for this DNA
	dataQualityGuards: string[]; // QA checks to avoid cross-industry contamination
	notes?: string;
}

// ============================================================================
// BUSINESS CLASSIFICATION ENGINE
// ============================================================================

class BusinessClassifier {
	private industryPatterns: Map<string, { keywords: string[], subIndustries: string[] }>;
	private businessModelPatterns: Map<string, string[]>;

	constructor() {
		this.initializePatterns();
	}

	async classifyBusiness(description: string): Promise<BusinessDNA> {
		const text = description.toLowerCase().trim();
    
		// Primary industry classification
		const industry = this.classifyIndustry(text);
		const subIndustry = this.classifySubIndustry(text, industry);
    
		// Business model detection
		const businessModel = this.classifyBusinessModel(text);
		const customerType = this.classifyCustomerType(text);
    
		// Structural characteristics
		const stage = this.inferStage(text);
		const scale = this.inferScale(text);
		const capitalIntensity = this.inferCapitalIntensity(text, industry);
		const regulatoryComplexity = this.inferRegulatoryComplexity(industry, subIndustry);
		const networkEffects = this.inferNetworkEffects(businessModel, text);
    
		// Calculate classification confidence
		const confidence = this.calculateClassificationConfidence(text, {
			industry, subIndustry, businessModel, customerType
		});

		return {
			industry,
			subIndustry,
			businessModel,
			customerType,
			stage,
			scale,
			capitalIntensity,
			regulatoryComplexity,
			networkEffects,
			confidence
		};
	}

	private classifyIndustry(text: string): string {
		const patterns = {
			'fintech': ['payment', 'banking', 'finance', 'lending', 'crypto', 'wallet', 'trading'],
			'healthtech': ['health', 'medical', 'therapy', 'wellness', 'fitness', 'telemedicine'],
			'edtech': ['education', 'learning', 'course', 'training', 'school', 'student'],
			'ecommerce': ['shop', 'store', 'retail', 'marketplace', 'buy', 'sell', 'product', 'shipping', 'fulfillment', 'inventory', 'warehouse', '3pl', 'box', 'crate', 'bag'],
			'saas': ['software', 'platform', 'tool', 'dashboard', 'api', 'service', 'management'],
			'beauty': ['skincare', 'makeup', 'cosmetics', 'beauty', 'hair', 'nail'],
			'food': ['restaurant', 'food', 'delivery', 'meal', 'recipe', 'cooking', 'coffee', 'beverage', 'roast', 'roastery', 'beans'],
			'travel': ['travel', 'booking', 'hotel', 'flight', 'vacation', 'trip'],
			'real-estate': ['property', 'real estate', 'housing', 'rent', 'buy home'],
			'entertainment': ['game', 'music', 'video', 'streaming', 'content', 'media']
		} as const;

		let bestMatch: string = 'technology';
		let maxScore = 0;

		for (const [ind, keywords] of Object.entries(patterns)) {
			const score = keywords.reduce((acc, keyword) => 
				acc + (text.includes(keyword) ? 1 : 0), 0
			);
			if (score > maxScore) {
				maxScore = score;
				bestMatch = ind;
			}
		}

		return bestMatch;
	}

	private classifySubIndustry(text: string, industry: string): string {
		const subPatterns: Record<string, Record<string, string[]>> = {
			'beauty': {
				'skincare': ['skin', 'face', 'moisturizer', 'serum', 'cleanser'],
				'makeup': ['lipstick', 'foundation', 'mascara', 'eyeshadow'],
				'haircare': ['shampoo', 'conditioner', 'hair treatment']
			},
			'fintech': {
				'payments': ['payment', 'pay', 'transaction', 'checkout'],
				'lending': ['loan', 'credit', 'lending', 'borrow'],
				'investing': ['invest', 'trading', 'portfolio', 'stocks']
			},
			'saas': {
				'productivity': ['productivity', 'task', 'project', 'management'],
				'communication': ['chat', 'video', 'messaging', 'collaboration'],
				'analytics': ['analytics', 'data', 'dashboard', 'reporting']
			}
		};

		if (!subPatterns[industry]) return 'general';

		let bestMatch = 'general';
		let maxScore = 0;

		for (const [sub, keywords] of Object.entries(subPatterns[industry])) {
			const score = keywords.reduce((acc, keyword) => 
				acc + (text.includes(keyword) ? 1 : 0), 0
			);
			if (score > maxScore) {
				maxScore = score;
				bestMatch = sub;
			}
		}

		return bestMatch;
	}

	private classifyBusinessModel(text: string): string {
		// Specialized early check: physical subscription (DTC boxes like coffee)
		const subIndicators = ['subscription', 'subscribe', 'recurring', 'monthly', 'quarterly'];
		const physicalIndicators = ['ship', 'shipping', 'box', 'crate', 'bag', 'inventory', 'warehouse', '3pl', 'fulfillment', 'packaging', 'beans', 'coffee'];
		const hasSub = subIndicators.some(k => text.includes(k));
		const hasPhysical = physicalIndicators.some(k => text.includes(k));
		if (hasSub && hasPhysical) {
			return 'physical-subscription';
		}

		const patterns = {
			'physical-subscription': ['subscription', 'monthly', 'recurring', 'ship', 'shipping', 'box', 'crate', 'bag', 'inventory', 'warehouse', '3pl', 'fulfillment', 'packaging', 'coffee', 'beans'],
			'subscription': ['subscription', 'monthly', 'recurring', 'saas'],
			'marketplace': ['marketplace', 'platform', 'connect', 'two-sided'],
			'ecommerce': ['sell', 'product', 'inventory', 'shipping'],
			'freemium': ['free', 'premium', 'upgrade', 'basic plan'],
			'advertising': ['ads', 'advertising', 'sponsored', 'free app'],
			'transaction': ['commission', 'transaction fee', 'per transaction'],
			'service': ['service', 'consulting', 'done for you']
		} as const;

		let bestMatch = 'direct-sales';
		let maxScore = 0;

		for (const [model, keywords] of Object.entries(patterns)) {
			const score = keywords.reduce((acc, keyword) => 
				acc + (text.includes(keyword) ? 1 : 0), 0
			);
			if (score > maxScore) {
				maxScore = score;
				bestMatch = model;
			}
		}

		return bestMatch;
	}

	private classifyCustomerType(text: string): BusinessDNA['customerType'] {
		const b2bIndicators = ['business', 'company', 'enterprise', 'team', 'organization', 'saas'];
		const marketplaceIndicators = ['marketplace', 'platform', 'connect', 'buyers and sellers'];
		const b2b2cIndicators = ['white label', 'partner', 'reseller'];

		if (marketplaceIndicators.some(indicator => text.includes(indicator))) {
			return 'marketplace';
		}
		if (b2b2cIndicators.some(indicator => text.includes(indicator))) {
			return 'b2b2c';
		}
		if (b2bIndicators.some(indicator => text.includes(indicator))) {
			return 'b2b';
		}
		return 'b2c';
	}

	private inferStage(text: string): BusinessDNA['stage'] {
		if (text.includes('launched') || text.includes('selling') || text.includes('customers')) {
			return 'launched';
		}
		if (text.includes('prototype') || text.includes('beta') || text.includes('testing')) {
			return 'prototype';
		}
		if (text.includes('mvp') || text.includes('minimum viable')) {
			return 'mvp';
		}
		return 'idea';
	}

	private inferScale(text: string): BusinessDNA['scale'] {
		if (text.includes('global') || text.includes('worldwide') || text.includes('international')) {
			return 'global';
		}
		if (text.includes('national') || text.includes('country')) {
			return 'national';
		}
		if (text.includes('regional') || text.includes('state')) {
			return 'regional';
		}
		return 'local';
	}

	private inferCapitalIntensity(text: string, industry: string): BusinessDNA['capitalIntensity'] {
		const highCapitalIndustries = ['manufacturing', 'hardware', 'biotech', 'real-estate'];
		const lowCapitalIndicators = ['software', 'app', 'digital', 'online', 'service'];

		if (highCapitalIndustries.includes(industry) || 
				text.includes('manufacturing') || text.includes('hardware')) {
			return 'high';
		}
		if (lowCapitalIndicators.some(indicator => text.includes(indicator))) {
			return 'low';
		}
		return 'medium';
	}

	private inferRegulatoryComplexity(industry: string, subIndustry: string): BusinessDNA['regulatoryComplexity'] {
		const highRegIndustries = ['fintech', 'healthtech', 'pharmaceuticals', 'banking'];
		const mediumRegIndustries = ['food', 'beauty', 'real-estate'];

		if (highRegIndustries.includes(industry)) return 'high';
		if (mediumRegIndustries.includes(industry)) return 'medium';
		return 'low';
	}

	private inferNetworkEffects(businessModel: string, text: string): BusinessDNA['networkEffects'] {
		if (businessModel === 'marketplace' || text.includes('network') || text.includes('viral')) {
			return 'strong';
		}
		if (businessModel === 'social' || text.includes('community') || text.includes('sharing')) {
			return 'weak';
		}
		return 'none';
	}

	private calculateClassificationConfidence(
		text: string, 
		classification: Partial<BusinessDNA>
	): number {
		// Simple heuristic: longer descriptions with clear indicators = higher confidence
		const length = text.length;
		const hasIndustryIndicators = text.includes('industry') || text.includes('market');
		const hasBusinessModelIndicators = Object.values(classification).some(v => 
			text.includes((v as any)?.toLowerCase?.() || '')
		);

		let confidence = 0.5;
		if (length > 100) confidence += 0.2;
		if (length > 200) confidence += 0.1;
		if (hasIndustryIndicators) confidence += 0.1;
		if (hasBusinessModelIndicators) confidence += 0.1;

		return Math.min(0.95, confidence);
	}

	private initializePatterns(): void {
		// Initialize pattern maps for classification
		this.industryPatterns = new Map();
		this.businessModelPatterns = new Map();
	}
}

// ============================================================================
// MARKET INTELLIGENCE ENGINE
// ============================================================================

// Optional provider for external research; default implementation uses internal heuristics
export interface ResearchProvider {
	research(prompt: string, opts: { industry: string; timeoutMs?: number }): Promise<any>;
}

let globalResearchProvider: ResearchProvider | undefined;
export function setResearchProvider(provider: ResearchProvider | undefined) {
	globalResearchProvider = provider;
}

class MarketIntelligenceEngine {
	constructor(private provider?: ResearchProvider) {}
	async gatherMarketIntelligence(
		ideaDescription: string, 
		dna: BusinessDNA
	): Promise<MarketIntelligence> {
    
		// Build industry-specific research prompts
		const prompt = this.buildMarketResearchPrompt(ideaDescription, dna);
		void prompt; // prompt used by providers when integrated
    
			try {
				// Prefer external research if provider is configured, with a timeout guard
				let marketData: any | null = null;
				if (this.provider) {
					marketData = await this.withTimeout(
						this.provider.research(prompt, { industry: dna.industry, timeoutMs: 8000 }),
						8500
					);
				}
							if (!marketData) {
								marketData = await this.callMarketResearchAPI(prompt, dna);
							}
							const parsed = this.parseMarketData(marketData, dna);
							// Competitive intelligence overlay (Layer 3)
							const ci = this.assessCompetitiveDensity(dna, ideaDescription);
							if (ci.level !== undefined) parsed.competition_level = Math.max(1, Math.min(10, Math.min(parsed.competition_level, ci.level)));
							if (ci.incumbents?.length) parsed.notable_competitors = ci.incumbents;
							return parsed;
			} catch (error) {
			console.warn('Market intelligence failed, using fallback data:', error);
			return this.getFallbackMarketData(dna);
		}
	}

	private buildMarketResearchPrompt(idea: string, dna: BusinessDNA): string {
		return `
		Analyze the market opportunity for this business idea:
    
		Business: "${idea}"
		Industry: ${dna.industry} (${dna.subIndustry})
		Business Model: ${dna.businessModel}
		Customer Type: ${dna.customerType}
		Geographic Scale: ${dna.scale}
    
		Research and provide specific data for:
		1. Total Addressable Market (TAM) size in USD
		2. Industry growth rate (CAGR)
		3. Competition density (0-10 scale, 10 = low competition)
		4. Key market trends affecting this segment
		5. Regulatory barriers or requirements
		6. Typical gross margins for ${dna.businessModel} businesses in ${dna.industry}
		7. Customer acquisition difficulty (0-10, 10 = very difficult)
    
		Focus on ${dna.industry} industry data specifically for ${dna.subIndustry} segment.
		Exclude data from unrelated industries.
		Provide sources and confidence level for your estimates.
		`;
	}

	private async callMarketResearchAPI(prompt: string, dna: BusinessDNA): Promise<any> {
		// This would integrate with your actual AI providers
		// For now, return mock data that varies by industry
		await new Promise(resolve => setTimeout(resolve, 1000)); // Simulate API call
		void prompt; void dna;
		return this.generateRealisticMarketData(dna);
	}

		private async withTimeout<T>(p: Promise<T>, ms: number): Promise<T | null> {
			return new Promise((resolve) => {
				const timer = setTimeout(() => resolve(null), ms);
				p.then((v) => { clearTimeout(timer); resolve(v); }).catch(() => { clearTimeout(timer); resolve(null); });
			});
		}

	private generateRealisticMarketData(dna: BusinessDNA): any {
		const industryData: Record<string, Partial<MarketIntelligence>> = {
			'beauty': {
				tam_usd: 189_000_000_000,
				growth_rate: 0.055,
				competition_level: 4,
				typical_margins: 0.70,
				customer_acquisition_difficulty: 6
			},
			'fintech': {
				tam_usd: 124_000_000_000,
				growth_rate: 0.15,
				competition_level: 3,
				typical_margins: 0.80,
				customer_acquisition_difficulty: 8
			},
			'saas': {
				tam_usd: 195_000_000_000,
				growth_rate: 0.18,
				competition_level: 2,
				typical_margins: 0.75,
				customer_acquisition_difficulty: 7
			}
		};

		const base = industryData[dna.industry] || {
			tam_usd: 50_000_000_000,
			growth_rate: 0.08,
			competition_level: 5,
			typical_margins: 0.40,
			customer_acquisition_difficulty: 6
		};

		return {
			...base,
			key_trends: this.getIndustryTrends(dna),
			regulatory_barriers: this.getRegulatoryBarriers(dna),
			confidence: 0.8
		};
	}

	private getIndustryTrends(dna: BusinessDNA): string[] {
		const trendMap: Record<string, string[]> = {
			'beauty': ['Clean beauty movement', 'Personalization trend', 'Social commerce growth'],
			'fintech': ['Embedded finance', 'Open banking', 'Crypto adoption'],
			'saas': ['AI integration', 'Vertical specialization', 'Usage-based pricing']
		};
    
		return trendMap[dna.industry] || ['Digital transformation', 'Mobile-first approach'];
	}

	private getRegulatoryBarriers(dna: BusinessDNA): string[] {
		const barrierMap: Record<string, string[]> = {
			'fintech': ['PCI compliance', 'Banking regulations', 'AML/KYC requirements'],
			'healthtech': ['HIPAA compliance', 'FDA approval', 'Medical device regulations'],
			'beauty': ['FDA cosmetic regulations', 'Ingredient safety requirements']
		};
    
		return barrierMap[dna.industry] || ['General business regulations'];
	}

		private parseMarketData(data: any, dna: BusinessDNA): MarketIntelligence {
		void dna;
			return {
			tam_usd: data.tam_usd || 1_000_000_000,
			growth_rate: data.growth_rate || 0.1,
			competition_level: data.competition_level || 5,
			key_trends: data.key_trends || [],
			regulatory_barriers: data.regulatory_barriers || [],
			typical_margins: data.typical_margins || 0.5,
			customer_acquisition_difficulty: data.customer_acquisition_difficulty || 5,
				confidence: data.confidence || 0.7,
				notable_competitors: Array.isArray(data?.notable_competitors) ? data.notable_competitors : undefined
		};
	}

		private getFallbackMarketData(dna: BusinessDNA): MarketIntelligence {
		void dna;
		return {
			tam_usd: 10_000_000_000,
			growth_rate: 0.08,
			competition_level: 5,
			key_trends: ['Market growth', 'Digital adoption'],
			regulatory_barriers: ['Standard business requirements'],
			typical_margins: 0.4,
			customer_acquisition_difficulty: 5,
				confidence: 0.3,
				notable_competitors: []
		};
	}

		private assessCompetitiveDensity(dna: BusinessDNA, description: string): { level: number; incumbents?: string[] } {
			const text = (description || '').toLowerCase();
			const crowdedMarkets: Record<string, { incumbents: string[]; level: number }> = {
				'project-management': { incumbents: ['Monday.com', 'Asana', 'Notion', 'Trello', 'Jira'], level: 2 },
				'crm': { incumbents: ['Salesforce', 'HubSpot', 'Pipedrive'], level: 3 }
			};

			if (text.includes('project management') || text.includes('kanban') || text.includes('task tracking')) {
				const cfg = crowdedMarkets['project-management'];
				return { level: cfg.level, incumbents: cfg.incumbents };
			}
			if (text.includes('crm') || text.includes('customer relationship')) {
				const cfg = crowdedMarkets['crm'];
				return { level: cfg.level, incumbents: cfg.incumbents };
			}
			if (dna.industry === 'beauty' || dna.industry === 'ecommerce') {
				return { level: 4 };
			}
			return { level: 5 };
		}
}

// ============================================================================
// DYNAMIC WEIGHTING SYSTEM
// ============================================================================

class WeightingEngine {
	getIndustryWeights(dna: BusinessDNA): IndustryWeights {
		const baseWeights: IndustryWeights = {
			problem: 12,
			underserved: 10,
			feasibility: 12,
			differentiation: 10,
			demand_signals: 14,
			wtp: 8,
			market_quality: 10,
			gtm: 10,
			execution: 8,
			risk: 6,
		};

		// Adjust weights based on business DNA
		if (dna.customerType === 'marketplace') {
			return {
				...baseWeights,
				supply_demand_balance: 15,
				network_effects: 18,
				demand_signals: 18,
				market_quality: 15,
				problem: 8, // Less critical for marketplaces
				gtm: 8
			};
		}

		if (dna.regulatoryComplexity === 'high') {
			return {
				...baseWeights,
				regulatory_compliance: 15,
				execution: 15, // Higher execution requirements
				risk: 12,
				feasibility: 8 // Reduced emphasis on technical feasibility
			};
		}

		// SaaS subscriptions
		if ((dna.industry === 'saas') || (dna.businessModel === 'subscription' && dna.industry === 'saas')) {
			return {
				...baseWeights,
				wtp: 12, // Critical for subscription success
				demand_signals: 16,
				market_quality: 12,
				differentiation: 12,
				gtm: 12
			};
		}

		// Physical/DTC subscriptions (ecommerce/food)
		if (dna.businessModel === 'physical-subscription' || (dna.businessModel === 'subscription' && (dna.industry === 'ecommerce' || dna.industry === 'food'))) {
			return {
				...baseWeights,
				// Emphasize GTM and operational feasibility for DTC
				wtp: 10,
				demand_signals: 15,
				market_quality: 12,
				feasibility: 14,
				gtm: 12,
				risk: 8
			};
		}

		if (dna.networkEffects === 'strong') {
			return {
				...baseWeights,
				network_effects: 20,
				viral_potential: 15,
				demand_signals: 15,
				differentiation: 15,
				problem: 8
			};
		}

		return baseWeights;
	}

		describeStrategy(dna: BusinessDNA, weights: IndustryWeights): ValidationStrategy {
				// Phase 1: Dynamic classification -> weights
				// Phase 2: External research blended via market_data_weight
				// Phase 3: Industry-specific benchmarks and criteria below
			// Map internal weights to human-readable strategy with reasons
			const dim = (key: keyof IndustryWeights, label: string, reason: string) => ({ key, label, weight: (weights as any)[key] || 0, reason });

			const selected = [
				dim('market_quality', 'Market Opportunity', this.marketReason(dna)),
				dim('differentiation', 'Competitive Advantage', this.diffReason(dna)),
				dim('demand_signals', 'Demand Validation', this.demandReason(dna)),
				dim('wtp', 'Willingness to Pay', this.wtpReason(dna)),
				dim('gtm', 'Go-To-Market Fit', this.gtmReason(dna)),
				dim('feasibility', 'Technical/Operational Feasibility', this.feasibilityReason(dna)),
				dim('execution', 'Team & Execution Readiness', this.execReason(dna)),
				dim('risk', 'Risk Profile', this.riskReason(dna)),
			];

			// Business-specific additions
			if ((weights as any).network_effects) {
				selected.push(dim('network_effects' as any, 'Network Effects', 'Platform growth depends on user-to-user value transfer and liquidity.'));
			}
			if ((weights as any).supply_demand_balance) {
				selected.push(dim('supply_demand_balance' as any, 'Supply/Demand Balance', 'Marketplaces require balanced acquisition and retention on both sides.'));
			}
			if ((weights as any).regulatory_compliance) {
				selected.push(dim('regulatory_compliance' as any, 'Regulatory Compliance', 'Highly regulated categories need early compliance feasibility.'));
			}
			if ((weights as any).viral_potential) {
				selected.push(dim('viral_potential' as any, 'Viral Potential', 'Platforms/products with sharing loops benefit from viral growth.'));
			}

			// Benchmarks focus by DNA
			const benchmarks: string[] = [];
			// SaaS subscription benchmarks only for SaaS
			if (dna.industry === 'saas' || (dna.businessModel === 'subscription' && dna.industry === 'saas')) {
				benchmarks.push('LTV/CAC >= 3', 'Gross margin 70-80%', 'Payback < 12 months', 'Net retention');
			}
			// DTC physical subscription benchmarks for ecommerce/food
			if (dna.businessModel === 'physical-subscription' || (dna.businessModel === 'subscription' && (dna.industry === 'ecommerce' || dna.industry === 'food'))) {
				benchmarks.push('Gross margin 50-65%', 'Payback < 6 months', 'Contribution margin after CAC', 'Monthly churn < 8-10%');
			}
			if (dna.customerType === 'marketplace') {
				benchmarks.push('Liquidity (time-to-first-job)', 'Take rate vs leakage', 'Repeat rate by cohort');
			}
			if (dna.industry === 'beauty' || dna.industry === 'ecommerce') {
				benchmarks.push('Contribution margin after CAC', 'Conversion rate vs niche baseline', 'CAC vs AOV vs repeat');
			}
			if (dna.regulatoryComplexity === 'high') {
				benchmarks.push('Compliance milestones', 'Audit requirements', 'Data handling requirements');
			}

			const dataGuards = [
				`Use ${dna.industry} sources only for TAM/growth`,
				`Ignore benchmarks from unrelated models (e.g., SaaS metrics for skincare)`,
				'Cross-check competition lists for category fit',
			];

			return {
				selectedDimensions: selected
					.filter(s => s.weight > 0)
					.sort((a, b) => b.weight - a.weight),
				benchmarksFocus: benchmarks,
				dataQualityGuards: dataGuards,
				notes: `Strategy tailored for ${dna.industry} ${dna.businessModel} (${dna.customerType.toUpperCase()}) at ${dna.stage} stage.`
			};
		}

		private marketReason(dna: BusinessDNA) {
			if (dna.scale === 'global') return 'Global scope raises TAM expectations and growth thresholds.';
			if (dna.customerType === 'b2b') return 'B2B markets require clear ICP and reachable TAM.';
			return 'Right-sized TAM and healthy growth reduce go-to-market friction.';
		}
		private diffReason(dna: BusinessDNA) {
			if (dna.customerType === 'marketplace') return 'Defensibility hinges on liquidity, trust, and switching costs.';
			return 'Clear edge vs incumbents needed to win share and pricing power.';
		}
		private demandReason(dna: BusinessDNA) {
			if (dna.industry === 'beauty') return 'Beauty requires early signals due to high competition and brand preference.';
			return 'Real user signals de-risk false positives from desk research.';
		}
		private wtpReason(dna: BusinessDNA) {
			if (dna.businessModel === 'physical-subscription' || (dna.businessModel === 'subscription' && (dna.industry === 'ecommerce' || dna.industry === 'food'))) {
				return 'Unit economics hinge on COGS, shipping, and retention; prove contribution margin and <6 mo payback.';
			}
			if (dna.businessModel === 'subscription') return 'Recurring revenue viability depends on willingness to pay and retention.';
			return 'Monetization confidence is critical before scale efforts.';
		}
		private gtmReason(dna: BusinessDNA) {
			if (dna.customerType === 'b2b') return 'Channel clarity and efficient unit economics drive sales productivity.';
			return 'Efficient acquisition is required to reach PMF before capital runs short.';
		}
		private feasibilityReason(dna: BusinessDNA) {
			if (dna.capitalIntensity === 'high') return 'Capex and supply constraints raise feasibility bar.';
			return 'Build/ops feasibility must match available resources and timelines.';
		}
		private execReason(dna: BusinessDNA) {
			if (dna.regulatoryComplexity === 'high') return 'Regulatory execution requires domain expertise and process rigor.';
			return 'Team readiness and runway determine iteration speed and risk.';
		}
		private riskReason(_: BusinessDNA) {
			return 'Lower regulatory/platform/safety risks increase investability and speed.';
		}
}

// ============================================================================
// ENHANCED SCORING ENGINE
// ============================================================================

interface ComputedScores {
	problem: number;
	underserved: number;
	feasibility: number;
	differentiation: number;
	demand_signals: number;
	wtp: number;
	market_quality: number;
	gtm: number;
	execution: number;
	risk: number;
	// Dynamic additions
	network_effects?: number;
	regulatory_compliance?: number;
	supply_demand_balance?: number;
	viral_potential?: number;
	overall: number;
}

class EnhancedScoringEngine {
	private clamp = (n: number, min = 0, max = 10) => Math.max(min, Math.min(max, n));
	private nz = (n?: number, d = 0) => (typeof n === "number" && !isNaN(n) ? n : d);
	// Fix 2: Market Saturation Detection
	private detectMarketSaturation(idea: string, dna: BusinessDNA): {
		saturation: number; majorCompetitors: string[]; redFlags: string[];
	} {
		const text = (idea || '').toLowerCase();
		const saturatedMarkets: Record<string, { saturation: number; competitors: string[]; redFlags: string[] }> = {
			'project management': {
				saturation: 95,
				competitors: ['Monday.com ($7B)', 'Asana ($1.5B)', 'Notion ($10B)', 'Atlassian ($50B)'],
				redFlags: ['Extreme incumbent advantage', 'High switching costs', 'Network effects favor existing players']
			},
			'crm': {
				saturation: 92,
				competitors: ['Salesforce', 'HubSpot', 'Pipedrive', 'Zoho'],
				redFlags: ['Dominated by entrenched platforms', 'Expensive acquisition channels', 'High feature parity expectations']
			},
			'email marketing': {
				saturation: 90,
				competitors: ['Mailchimp', 'Klaviyo', 'Campaign Monitor', 'Constant Contact'],
				redFlags: ['Commoditized category', 'Price wars', 'Deliverability arms race']
			}
		};

		for (const [market, data] of Object.entries(saturatedMarkets)) {
			if (text.includes(market)) {
				return { saturation: data.saturation, majorCompetitors: data.competitors, redFlags: data.redFlags };
			}
		}

		// fallback: infer by DNA for known crowded segments
		if (dna.industry === 'saas' && (text.includes('management') || text.includes('productivity'))) {
			return { saturation: 75, majorCompetitors: [], redFlags: [] };
		}

		return { saturation: 30, majorCompetitors: [], redFlags: [] };
	}

	computeScores(
		input: ValidationInput,
		dna: BusinessDNA,
		marketData: MarketIntelligence,
		weights: IndustryWeights
	): ComputedScores {
    
		// Base scoring (from original framework)
		const baseScores = this.computeBaseScores(input);
    
		// Enhanced market quality using real data
		const enhancedMarketQuality = this.computeEnhancedMarketQuality(
			input, marketData, dna
		);

		// Business-specific scoring
		const businessSpecificScores = this.computeBusinessSpecificScores(
			input, dna, marketData
		);

		const allScores = {
			...baseScores,
			market_quality: enhancedMarketQuality,
			...businessSpecificScores
		} as Partial<ComputedScores> as ComputedScores;

		// Additional penalties for distribution (GTM) in dominated markets
		const sat = this.detectMarketSaturation(input.idea_text || '', dna);
		const diffReality2 = this.assessDifferentiation(input.idea_text || '');
		if ((sat.saturation >= 90 || sat.majorCompetitors.length >= 3) && diffReality2 <= 2) {
			allScores.gtm = Math.min(allScores.gtm, 2);
		}

		// Calculate weighted overall score
		const overall = this.calculateWeightedScore(allScores, weights);

		return {
			...allScores,
			overall
		};
	}

	// Fix 3: Realistic Demand vs Supply Analysis
	private analyzeDemandSupply(idea: string): { demandScore: number; supplyScore: number; realOpportunity: number } {
		const text = (idea || '').toLowerCase();
		if (text.includes('project management')) {
			return { demandScore: 10, supplyScore: 10, realOpportunity: 2 };
		}
		if (text.includes('crm') || text.includes('email marketing')) {
			return { demandScore: 10, supplyScore: 9, realOpportunity: 3 };
		}
		return { demandScore: 5, supplyScore: 5, realOpportunity: 5 };
	}

	// Fix 4: Differentiation Reality Check
	private assessDifferentiation(idea: string): number {
		const text = (idea || '').toLowerCase();
		const genericFeatures = [
			'task tracking', 'deadlines', 'team collaboration', 'slack integration', 'google workspace',
			'kanban', 'gantt', 'templates'
		];
		const mentioned = genericFeatures.filter(f => text.includes(f));
		if (mentioned.length > 3 && !text.includes('novel') && !text.includes('unique') && !text.includes('proprietary')) {
			return 1;
		}
		return 5;
	}

	private computeBaseScores(input: ValidationInput) {
		const normalizeYesNo = (v?: number) => this.clamp(this.nz(v, 0));
    
		const problem = (
			normalizeYesNo(input.unavoidable) * 0.35 +
			normalizeYesNo(input.urgency) * 0.25 +
			normalizeYesNo(input.pain_gain_ratio) * 0.25 +
			normalizeYesNo(input.whitespace) * 0.15
		);

		const underserved = normalizeYesNo(input.underserved);
		const feasibility = normalizeYesNo(input.feasibility);

		// Enhanced differentiation scoring
		const attr = input.attributes || {};
		const attrDiff = (
			this.nz(attr.Disruptive, 0) * 0.35 +
			this.nz(attr.Defensible, 0) * 0.35 +
			this.nz(attr.Discontinuous, 0) * 0.15 +
			((this.nz(attr.SocialNeed) + this.nz(attr.Growth) + this.nz(attr.Achievement)) / 3) * 0.15
		) / 1.0;

		let differentiation = (
			normalizeYesNo(input.competition_density) * 0.5 + 
			this.clamp(attrDiff) * 0.5
		);
		// Reality check based on idea text
		const diffReality = this.assessDifferentiation(input.idea_text || '');
		differentiation = Math.min(differentiation, diffReality);

		// Demand signals
		const interviews = this.clamp(this.nz(input.interviews, 0) >= 10 ? 6 : this.nz(input.interviews, 0) / 2);
		const pos = this.clamp(Math.round(this.nz(input.interviews_positive_pct, 0) / 10));
		const wlConv = this.clamp(Math.round(this.nz(input.waitlist_conv_rate_pct, 0) / 10));
		const lois = this.clamp(this.nz(input.lois, 0) > 5 ? 6 : this.nz(input.lois, 0));
		const pre = this.clamp(this.nz(input.preorders, 0) > 20 ? 10 : this.nz(input.preorders, 0) / 2);

		const demand_signals = this.clamp(
			interviews * 0.25 + pos * 0.2 + wlConv * 0.25 + lois * 0.15 + pre * 0.15
		);

		// WTP
		const wtp = this.clamp(
			normalizeYesNo(input.willingness_to_pay) * 0.7 +
			this.clamp(this.nz(input.price_point, 0) > 0 ? 7 : 0) * 0.3
		);

		// GTM
		const ltv = this.nz(input.ltv_estimate, 0);
		const cac = this.nz(input.cac_estimate, 0);
		const ltv_cac_ok = ltv > 0 && cac > 0 ? ltv / cac >= 3 : undefined;

		let gtm = this.clamp(
			normalizeYesNo(input.channels_clarity) * 0.6 +
			this.clamp(ltv_cac_ok === undefined ? 5 : ltv_cac_ok ? 9 : 2) * 0.4
		);
		// Distribution penalty for crowded, generic plays (applied later too)
		if ((input.idea_text || '').toLowerCase().includes('project management')) {
			gtm = Math.min(gtm, 3);
		}

		// Execution
		const execution = this.clamp(
			normalizeYesNo(input.team_experience) * 0.7 +
			this.clamp(this.nz(input.capital_runway_months, 0) >= 6 ? 8 : this.nz(input.capital_runway_months, 0) / 2) * 0.3
		);

		// Risk (reverse scoring)
		const reg = this.nz(input.regulatory_risk, 0);
		const plat = this.nz(input.platform_dependency_risk, 0);
		const safety = this.nz(input.safety_risk, 0);
		const risk = this.clamp(10 - (reg * 0.5 + plat * 0.25 + safety * 0.25));

		return {
			problem,
			underserved,
			feasibility,
			differentiation,
			demand_signals,
			wtp,
			gtm,
			execution,
			risk
		};
	}

	private computeEnhancedMarketQuality(
		input: ValidationInput,
		marketData: MarketIntelligence,
		dna: BusinessDNA
	): number {
		// Combine user input with real market data
			const userTamQuality = this.nz(input.tam_quality, 5);
			const userGrowthQuality = this.nz(input.growth_rate_quality, 5);
			const researchWeight = Math.max(0, Math.min(1, this.nz(input.market_data_weight, 0.6))); // Phase 2
    
		// Score market data
		const tamScore = this.scoreTAM(marketData.tam_usd, dna);
		const growthScore = this.scoreGrowthRate(marketData.growth_rate);
		const competitionScore = marketData.competition_level; // Already 0-10 scale
    
		// Weight real data higher than user estimates
			const tamBlend = userTamQuality * (1 - researchWeight) + tamScore * researchWeight;
			const growthBlend = userGrowthQuality * (1 - researchWeight) + growthScore * researchWeight;
			let mq = this.clamp(tamBlend * 0.5 + growthBlend * 0.3 + competitionScore * 0.2);
			// Apply demand vs supply reality and saturation caps
			const ds = this.analyzeDemandSupply(input.idea_text || '');
			const sat = this.detectMarketSaturation(input.idea_text || '', dna);
			if (sat.saturation >= 90) mq = Math.min(mq, 2);
			else if (sat.saturation >= 75) mq = Math.min(mq, 4);
			mq = Math.min(mq, ds.realOpportunity);
			return this.clamp(mq);
	}

	private scoreTAM(tamUsd: number, dna: BusinessDNA): number {
		// Score TAM based on business type expectations
		const tamBillion = tamUsd / 1_000_000_000;
    
		if (dna.scale === 'global') {
			if (tamBillion > 100) return 10;
			if (tamBillion > 50) return 8;
			if (tamBillion > 20) return 6;
			return 4;
		} else if (dna.scale === 'national') {
			if (tamBillion > 10) return 10;
			if (tamBillion > 5) return 8;
			if (tamBillion > 1) return 6;
			return 4;
		} else {
			if (tamBillion > 1) return 10;
			if (tamBillion > 0.5) return 8;
			return 6;
		}
	}

	private scoreGrowthRate(growthRate: number): number {
		if (growthRate > 0.20) return 10;
		if (growthRate > 0.15) return 8;
		if (growthRate > 0.10) return 6;
		if (growthRate > 0.05) return 4;
		return 2;
	}

	private computeBusinessSpecificScores(
		input: ValidationInput,
		dna: BusinessDNA,
		marketData: MarketIntelligence
	) {
		const scores: Partial<ComputedScores> = {};

		// Marketplace-specific scoring
		if (dna.customerType === 'marketplace') {
			scores.supply_demand_balance = this.scoreSupplyDemandBalance(input, dna);
			scores.network_effects = this.scoreNetworkEffects(input, dna);
		}

		// High regulatory industries
		if (dna.regulatoryComplexity === 'high') {
			scores.regulatory_compliance = this.scoreRegulatoryCompliance(input, dna, marketData);
		}

		// Viral/network businesses
		if (dna.networkEffects !== 'none') {
			scores.viral_potential = this.scoreViralPotential(input, dna);
		}

		return scores;
	}

	private scoreSupplyDemandBalance(input: ValidationInput, dna: BusinessDNA): number {
		// Heuristic scoring for marketplace supply/demand balance
		const demandSignals = this.nz(input.interviews, 0) + this.nz(input.waitlist_signups, 0);
		const feasibility = this.nz(input.feasibility, 5);
    
		// Strong demand + feasible supply = good balance
		return this.clamp((demandSignals > 20 ? 8 : 4) + feasibility * 0.6);
	}

	private scoreNetworkEffects(input: ValidationInput, dna: BusinessDNA): number {
		// Score based on network effect potential
		if (dna.networkEffects === 'strong') {
			const viralIndicators = (input.attributes?.Growth || 0) + (input.attributes?.Recognition || 0);
			return this.clamp(7 + viralIndicators * 0.3);
		}
		return this.clamp(dna.networkEffects === 'weak' ? 5 : 2);
	}

	private scoreRegulatoryCompliance(
		input: ValidationInput,
		dna: BusinessDNA,
		marketData: MarketIntelligence
	): number {
		const regulatoryRisk = this.nz(input.regulatory_risk, 5);
		const teamExperience = this.nz(input.team_experience, 5);
		const barrierComplexity = marketData.regulatory_barriers.length;
    
		// Higher team experience + lower regulatory risk + fewer barriers = higher score
		return this.clamp(
			(10 - regulatoryRisk) * 0.4 + 
			teamExperience * 0.4 + 
			this.clamp(10 - barrierComplexity) * 0.2
		);
	}

	private scoreViralPotential(input: ValidationInput, dna: BusinessDNA): number {
		const socialAttributes = (input.attributes?.Recognition || 0) + 
													 (input.attributes?.Growth || 0) + 
													 (input.attributes?.SocialNeed || 0);
    
		const networkPotential = dna.networkEffects === 'strong' ? 8 : 
													 dna.networkEffects === 'weak' ? 5 : 2;
    
		return this.clamp((socialAttributes / 3) * 0.6 + networkPotential * 0.4);
	}

	private calculateWeightedScore(scores: Partial<ComputedScores>, weights: IndustryWeights): number {
		let totalScore = 0;
		let totalWeight = 0;

		// Calculate weighted score for each dimension
		for (const [dimension, weight] of Object.entries(weights)) {
			const score = (scores as any)[dimension as keyof ComputedScores] as number | undefined;
			if (typeof score === 'number' && typeof weight === 'number') {
				totalScore += score * weight;
				totalWeight += weight;
			}
		}

		// Normalize to 0-100 scale
		return totalWeight > 0 ? Math.round((totalScore / totalWeight) * 10) : 0;
	}
}

// ============================================================================
// ENHANCED DECISION ENGINE
// ============================================================================

class EnhancedDecisionEngine {
	private qcRules: Map<string, QCRule[]>;
	private redFlags: Map<string, RedFlag[]>;

	// Enhanced Red Flags (Market Reality)
	private MARKET_REALITY_FLAGS: RedFlag[] = [
		{
			id: 'incumbent-domination',
			when: (ctx: any) => {
				const idea = (ctx?.input?.idea_text || '').toLowerCase();
				return idea.includes('project management') || idea.includes('crm') || idea.includes('email marketing');
			},
			message: 'Market dominated by billion-dollar incumbents with strong network effects',
			kill: false
		},
		{
			id: 'generic-feature-set',
			when: (ctx: any) => {
				const diff = ctx?.scores?.differentiation ?? 10;
				const density = ctx?.input?.competition_density ?? 5;
				return diff < 3 && density < 3; // crowded market + weak differentiation
			},
			message: 'Generic features in crowded market - unclear path to customer acquisition',
			kill: false
		},
		{
			id: 'pricing-unrealistic',
			when: (ctx: any) => {
				const idea = (ctx?.input?.idea_text || '').toLowerCase();
				return idea.includes('project management') && idea.includes('$29');
			},
			message: 'Pricing below market leaders suggests unsustainable unit economics',
			kill: false
		}
	];

	constructor() {
		this.initializeRules();
	}

	makeDecision(
		scores: ComputedScores,
		dna: BusinessDNA,
		marketData: MarketIntelligence,
		input: ValidationInput
	): {
		status: ValidateResponse['status'];
		reasoning: string;
		risks: string[];
		highlights: string[];
	} {
		const context = { scores, dna, marketData, input };
    
		// Check industry-specific red flags
		const industryRedFlags = this.getIndustryRedFlags(dna);
		const triggeredRedFlags = industryRedFlags.filter(flag => flag.when(context as any));
		const killers = triggeredRedFlags.filter(flag => flag.kill);

		// Check industry-specific QC rules  
		const industryQCRules = this.getIndustryQCRules(dna);
		const triggeredQC = industryQCRules.filter(rule => rule.when(context as any));

		// Hard stops
		if (killers.length > 0) {
			return {
				status: 'NO-GO',
				reasoning: `Critical issues identified: ${killers.map(k => k.message).join('; ')}`,
				risks: triggeredRedFlags.map(r => r.message),
				highlights: []
			};
		}

		// Determine recommendation based on scores and business context
		const recommendation = this.determineRecommendation(scores, dna, marketData, input);
		const highlights = this.generateHighlights(scores, dna);

		return {
			status: recommendation.status,
			reasoning: recommendation.reasoning,
			risks: [...triggeredRedFlags.map(r => r.message), ...triggeredQC.map(q => q.message)],
			highlights
		};
	}

		// Public utility: evaluate red flags only (Layer 2 helper)
		evaluateRedFlags(
			scores: ComputedScores,
			dna: BusinessDNA,
			input: ValidationInput
		): { triggered: RedFlag[]; killers: RedFlag[] } {
			const industryRedFlags = this.getIndustryRedFlags(dna);
			const context = { scores, dna, input } as any;
			const triggered = industryRedFlags.filter(flag => flag.when(context));
			const killers = triggered.filter(flag => flag.kill);
			return { triggered, killers };
		}

	private determineRecommendation(
		scores: ComputedScores,
		dna: BusinessDNA,
		marketData: MarketIntelligence,
		input: ValidationInput
	): { status: ValidateResponse['status']; reasoning: string } {
		void marketData;
    
		const overall = scores.overall;
    
		// Industry-specific thresholds
		const thresholds = this.getIndustryThresholds(dna);

		// Special handling: oversaturated PM software with generic features
		const ideaText = (input?.idea_text || '').toLowerCase();
		if (ideaText.includes('project management') && scores.market_quality <= 3 && scores.differentiation <= 2) {
			return {
				status: 'NO-GO',
				reasoning: 'Entering oversaturated market against billion-dollar incumbents with generic feature set and lower pricing. No clear differentiation or customer acquisition advantage identified.'
			};
		}
    
		if (overall >= thresholds.go) {
			return {
				status: 'GO',
				reasoning: `Strong validation across key dimensions with ${overall}% overall score. ${dna.industry} market conditions favorable.`
			};
		}
    
		if (overall >= thresholds.review) {
			const weakAreas = this.identifyWeakAreas(scores, dna);
			return {
				status: 'REVIEW',
				reasoning: `Moderate potential (${overall}%) but address: ${weakAreas.join(', ')}`
			};
		}
    
		return {
			status: 'NO-GO',
			reasoning: `Significant challenges with ${overall}% score. Consider pivot or alternative approach.`
		};
	}

	private getIndustryThresholds(dna: BusinessDNA): { go: number; review: number } {
		// Different industries have different risk/reward profiles
		const thresholdMap: Record<string, { go: number; review: number }> = {
			'fintech': { go: 75, review: 60 }, // Higher bar due to regulation
			'healthtech': { go: 75, review: 60 }, // Higher bar due to safety
			'marketplace': { go: 70, review: 55 }, // Network effects can overcome moderate scores
			'saas': { go: 70, review: 55 }, // Scalable model
			'beauty': { go: 65, review: 50 }, // Brand-driven market
			'ecommerce': { go: 65, review: 50 } // Execution-heavy
		};

		return thresholdMap[dna.industry] || { go: 70, review: 55 };
	}

	private identifyWeakAreas(scores: ComputedScores, dna: BusinessDNA): string[] {
		void dna;
		const weak: string[] = [];
    
		if (scores.problem < 6) weak.push('problem urgency');
		if (scores.market_quality < 6) weak.push('market opportunity');
		if (scores.demand_signals < 5) weak.push('demand validation');
		if (scores.feasibility < 6) weak.push('execution feasibility');
		if (scores.differentiation < 5) weak.push('competitive differentiation');
    
		// Business-specific weak areas
		if (dna.customerType === 'marketplace' && scores.supply_demand_balance && scores.supply_demand_balance < 6) {
			weak.push('marketplace dynamics');
		}
    
		if (dna.regulatoryComplexity === 'high' && scores.regulatory_compliance && scores.regulatory_compliance < 6) {
			weak.push('regulatory compliance');
		}

		return weak;
	}

	private generateHighlights(scores: ComputedScores, dna: BusinessDNA): string[] {
		const highlights: string[] = [];
    
		if (scores.problem >= 8) highlights.push('Strong problem-solution fit identified');
		if (scores.market_quality >= 8) highlights.push(`Attractive ${dna.industry} market opportunity`);
		if (scores.demand_signals >= 7) highlights.push('Positive early demand indicators');
		if (scores.differentiation >= 7) highlights.push('Clear competitive advantages');
		if (scores.execution >= 8) highlights.push('Strong execution capability');
    
		// Business-specific highlights
		if ((scores as any).network_effects && (scores as any).network_effects >= 8) {
			highlights.push('Strong network effects potential');
		}
    
		if ((scores as any).viral_potential && (scores as any).viral_potential >= 7) {
			highlights.push('High viral growth potential');
		}

		return highlights;
	}

	private getIndustryRedFlags(dna: BusinessDNA): RedFlag[] {
		const baseFlags: RedFlag[] = [
			{
				id: 'illegal',
				when: (ctx) => !!(ctx as any).input.illegal_or_prohibited,
				message: 'Illegal or prohibited domain',
				kill: true
			},
			{
				id: 'no-problem',
				when: (ctx) => (ctx as any).scores.problem < 3 && (ctx as any).scores.underserved < 3,
				message: 'No compelling problem identified',
				kill: true
			},
			{
				id: 'impossible',
				when: (ctx) => (ctx as any).scores.feasibility < 2,
				message: 'Not feasible with reasonable resources',
				kill: true
			}
		];

		// Add industry-specific red flags
		if (dna.industry === 'fintech') {
			baseFlags.push({
				id: 'regulatory-nightmare',
				when: (ctx) => ((ctx as any).input.regulatory_risk || 0) >= 8 && ((ctx as any).input.team_experience || 0) < 4,
				message: 'High regulatory risk without domain expertise',
				kill: true
			});
		}

		if (dna.customerType === 'marketplace') {
			baseFlags.push({
				id: 'chicken-egg-unsolved',
				when: (ctx) => (ctx as any).scores.supply_demand_balance && (ctx as any).scores.supply_demand_balance < 3,
				message: 'No clear solution to marketplace chicken-and-egg problem',
				kill: false
			});
		}

		// Merge with market reality flags
		return [...baseFlags, ...this.MARKET_REALITY_FLAGS];
	}

	private getIndustryQCRules(dna: BusinessDNA): QCRule[] {
		const baseRules: QCRule[] = [
			{
				id: 'low-urgency',
				when: (ctx) => (ctx as any).scores.problem < 4,
				message: 'Low customer urgency - validate problem intensity',
				severity: 'med'
			},
			{
				id: 'weak-demand',
				when: (ctx) => (ctx as any).scores.demand_signals < 5,
				message: 'Insufficient demand validation - run more customer interviews',
				severity: 'high'
			}
		];

		// Add industry-specific QC rules
		if ((dna as any).businessModel === 'subscription') {
			baseRules.push({
				id: 'subscription-retention-risk',
				when: (ctx) => (ctx as any).scores.wtp < 6 && (ctx as any).scores.problem < 7,
				message: 'Subscription model requires strong value proposition',
				severity: 'high'
			});
		}

		if (dna.networkEffects === 'strong') {
			baseRules.push({
				id: 'network-effects-strategy',
				when: (ctx) => (ctx as any).scores.viral_potential && (ctx as any).scores.viral_potential < 5,
				message: 'Network business needs clearer viral/growth strategy',
				severity: 'med'
			});
		}

		return baseRules;
	}

	private initializeRules(): void {
		this.qcRules = new Map();
		this.redFlags = new Map();
	}
}

// ============================================================================
// MAIN HYBRID VALIDATION SERVICE
// ============================================================================

export class HybridValidationService {
	private classifier: BusinessClassifier;
	private marketEngine: MarketIntelligenceEngine;
	private weightingEngine: WeightingEngine;
	private scoringEngine: EnhancedScoringEngine;
	private decisionEngine: EnhancedDecisionEngine;

	constructor() {
		this.classifier = new BusinessClassifier();
		// Use globally-registered provider if any; otherwise internal heuristics
		this.marketEngine = new MarketIntelligenceEngine(globalResearchProvider);
		this.weightingEngine = new WeightingEngine();
		this.scoringEngine = new EnhancedScoringEngine();
		this.decisionEngine = new EnhancedDecisionEngine();
	}

	async validateBusinessIdea(input: ValidationInput): Promise<ValidateResponse & {
		business_dna: BusinessDNA;
		market_intelligence: MarketIntelligence;
			validation_strategy: ValidationStrategy;
		methodology_explanation: string;
	}> {
		try {
			// Step 1: Classify business DNA
			const dna = await this.classifier.classifyBusiness(input.idea_text);
      
			if (dna.confidence < 0.4) {
				throw new Error('Unable to clearly classify business type. Please provide more specific details.');
			}

			// Step 2: Gather market intelligence
			const marketData = await this.marketEngine.gatherMarketIntelligence(input.idea_text, dna);
      
			// Step 3: Get industry-specific weights
			const weights = this.weightingEngine.getIndustryWeights(dna);
			const strategy = this.weightingEngine.describeStrategy(dna, weights);
      
			// Step 4: Compute enhanced scores
			const scores = this.scoringEngine.computeScores(input, dna, marketData, weights);
      
			// Step 5: Make decision with business context
			const decision = this.decisionEngine.makeDecision(scores, dna, marketData, input);
      
			// Step 6: Generate result
			const result = this.generateValidationResult(input, dna, marketData, scores, decision);
      
			return {
				...result,
				business_dna: dna,
				market_intelligence: marketData,
						validation_strategy: strategy,
				methodology_explanation: this.generateMethodologyExplanation(dna, weights)
			};
      
		} catch (error: any) {
			console.error('Hybrid validation failed:', error);
			throw new Error(`Validation failed: ${error.message}`);
		}
	}

	private generateValidationResult(
		input: ValidationInput,
		dna: BusinessDNA,
		marketData: MarketIntelligence,
		computedScores: ComputedScores,
		decision: any
	): ValidateResponse {
		void marketData;
    
		// Convert computed scores to API format
		const scores: Scores = {
			problem: this.round1(computedScores.problem),
			underserved: this.round1(computedScores.underserved),
			feasibility: this.round1(computedScores.feasibility),
			differentiation: this.round1(computedScores.differentiation),
			demand_signals: this.round1(computedScores.demand_signals),
			willingness_to_pay: this.round1(computedScores.wtp),
			market_quality: this.round1(computedScores.market_quality),
			gtm: this.round1(computedScores.gtm),
			execution: this.round1(computedScores.execution),
			risk: this.round1(computedScores.risk),
			overall: computedScores.overall
		} as Scores;

		// Add business-specific scores
		if ((computedScores as any).network_effects !== undefined) {
			(scores as any).network_effects = this.round1((computedScores as any).network_effects);
		}
		if ((computedScores as any).regulatory_compliance !== undefined) {
			(scores as any).regulatory_compliance = this.round1((computedScores as any).regulatory_compliance);
		}

		// Generate value proposition
		const value_prop = this.generateValueProposition(input, dna);
    
		// Generate target market description
		const target_market = this.generateTargetMarketDescription(input, dna);

		return {
			id: this.generateId(),
			status: decision.status,
			value_prop,
			highlights: decision.highlights,
			risks: decision.risks,
			scores,
			target_market,
			title: input.idea_text?.slice(0, 80),
			created_at: new Date().toISOString()
		};
	}

	private generateValueProposition(
		input: ValidationInput,
		dna: BusinessDNA
	): string {
		const ideaCore = input.idea_text || 'This business';
		const targetCustomer = input.target_customer || 
													(dna.customerType === 'b2b' ? 'businesses' : 'consumers');
    
		let valueDriver = '';
		// Prefer trends if provided elsewhere; here we stick to a generic rule
		if (dna.networkEffects === 'strong') {
			valueDriver = 'leverages network effects for competitive advantage';
		} else {
			valueDriver = `serves an underserved ${dna.industry} market`;
		}

		return `${ideaCore} — targeting ${targetCustomer} in the ${dna.industry} industry, ${valueDriver}.`;
	}

	private generateTargetMarketDescription(input: ValidationInput, dna: BusinessDNA): string {
		if (input.target_customer) {
			return `${dna.customerType.toUpperCase()} - ${input.target_customer}`;
		}
    
		return `${dna.customerType.toUpperCase()} ${dna.industry} (${dna.scale} scale)`;
	}

	private generateMethodologyExplanation(dna: BusinessDNA, weights: IndustryWeights): string {
		const keyFactors = Object.entries(weights)
			.sort(([,a], [,b]) => (b as number) - (a as number))
			.slice(0, 3)
			.map(([factor, weight]) => `${factor} (${weight}%)`)
			.join(', ');

		return `Validation adapted for ${dna.industry} ${dna.businessModel} business. Key factors: ${keyFactors}. Confidence: ${Math.round(dna.confidence * 100)}%`;
	}

	private round1(n: number): number {
		return Math.round(n * 10) / 10;
	}

	private generateId(): string {
		try {
			return (globalThis.crypto?.randomUUID?.() as string) ?? `${Date.now()}-${Math.random()}`;
		} catch {
			return `${Date.now()}-${Math.random()}`;
		}
	}

	// Convenience method for demo usage
	static createDemoInput(ideaText: string): ValidationInput {
		// Quick classification for demo defaults
		const quickDNA = {
			industry: ideaText.toLowerCase().includes('software') ? 'saas' : 'general',
			customerType: ideaText.toLowerCase().includes('business') ? 'b2b' : 'b2c'
		} as any;

		return {
			idea_text: ideaText,
			b2x: (quickDNA.customerType === 'b2b' ? 'B2B' : 'B2C') as any,
			// Conservative defaults that will be enhanced by real market data
			unavoidable: 6,
			urgency: 6,
			underserved: 6,
			feasibility: 7,
			pain_gain_ratio: 6,
			whitespace: 6,
			tam_quality: 6,
			growth_rate_quality: 6,
			competition_density: 5,
			willingness_to_pay: 6,
			channels_clarity: (quickDNA.customerType === 'b2b' ? 6 : 5) as any,
			team_experience: 6,
			capital_runway_months: 8,
			regulatory_risk: 3,
			platform_dependency_risk: 4,
			safety_risk: 2,
			attributes: {
				Disruptive: 6,
				Defensible: 5,
				Growth: 6
			}
		} as ValidationInput;
	}
}

// ============================================================================
// LAYER 2: MATHEMATICAL VALIDATION (Facade)
// ============================================================================

export interface ValidationResult extends ValidateResponse {
	business_dna: BusinessDNA;
	market_intelligence: MarketIntelligence;
	validation_strategy: ValidationStrategy;
	methodology_explanation: string;
	red_flags: string[];
	benchmarks: string[];
}

export class HybridValidationEngine {
	private classifier = new BusinessClassifier();
	private weighting = new WeightingEngine();
	private market = new MarketIntelligenceEngine();
	private scoring = new EnhancedScoringEngine();
	private decision = new EnhancedDecisionEngine();

	// 1) Extract Business DNA
	async classifyBusiness(ideaText: string) {
		return this.classifier.classifyBusiness(ideaText);
	}

	// 2) Get industry-specific weights and benchmarks
	getIndustryWeights(dna: BusinessDNA) {
		return this.weighting.getIndustryWeights(dna);
	}

	getIndustryBenchmarks(dna: BusinessDNA) {
		const weights = this.getIndustryWeights(dna);
		const strategy = this.weighting.describeStrategy(dna, weights);
		return { strategy, benchmarks: strategy.benchmarksFocus };
	}

	// 3) External (or local) market research
	async getMarketIntelligence(input: ValidationInput, dna: BusinessDNA) {
		void input; // future: may tailor prompt with additional fields
		return this.market.gatherMarketIntelligence(input.idea_text, dna);
	}

	// 4) Apply weighted scoring with context
	computeContextualScores(
		input: ValidationInput,
		dna: BusinessDNA,
		marketData: MarketIntelligence,
		weights: IndustryWeights
	) {
		return this.scoring.computeScores(input, dna, marketData, weights);
	}

	// 5) Apply business-specific red flags
	checkContextualRedFlags(scores: ComputedScores, dna: BusinessDNA, input: ValidationInput) {
		return this.decision.evaluateRedFlags(scores, dna, input);
	}

	// Generate final result compatible with existing API
	generateResult(
		input: ValidationInput,
		dna: BusinessDNA,
		marketData: MarketIntelligence,
		scores: ComputedScores,
		weights: IndustryWeights,
		redFlags: { triggered: RedFlag[]; killers: RedFlag[] }
	): ValidationResult {
		const service = new HybridValidationService();
		const decision = this.decision.makeDecision(scores, dna, marketData, input);
		const base = (service as any).generateValidationResult(input, dna, marketData, scores, decision) as ValidateResponse;
		const strategy = this.weighting.describeStrategy(dna, weights);

		return {
			...base,
			business_dna: dna,
			market_intelligence: marketData,
			validation_strategy: strategy,
			methodology_explanation: (service as any).generateMethodologyExplanation(dna, weights),
			red_flags: redFlags.triggered.map(f => f.message),
			benchmarks: strategy.benchmarksFocus
		};
	}

	// Full pipeline
	async validate(input: ValidationInput): Promise<ValidationResult> {
		const dna = await this.classifyBusiness(input.idea_text);
		const weights = this.getIndustryWeights(dna);
		const marketData = await this.getMarketIntelligence(input, dna);
		const scores = this.computeContextualScores(input, dna, marketData, weights);
		const redFlags = this.checkContextualRedFlags(scores, dna, input);
		return this.generateResult(input, dna, marketData, scores, weights, redFlags);
	}
}

// ============================================================================
// USAGE EXAMPLES
// ============================================================================

// Simple usage for your existing demo
export async function validateIdea(input: ValidationInput): Promise<ValidateResponse> {
	const service = new HybridValidationService();
	const result = await service.validateBusinessIdea(input);
  
	// Return standard ValidateResponse format for compatibility
	return {
		id: result.id,
		status: result.status,
		value_prop: result.value_prop,
		highlights: result.highlights,
		risks: result.risks,
		scores: result.scores,
		target_market: result.target_market,
		title: result.title,
		created_at: result.created_at
	};
}

// Enhanced usage with full context
export async function validateIdeaWithContext(input: ValidationInput) {
	const service = new HybridValidationService();
	return await service.validateBusinessIdea(input);
}

// Demo helper (drop-in replacement for your current makeDemoInputFromText)
export function makeDemoInputFromText(ideaText: string): ValidationInput {
	return HybridValidationService.createDemoInput(ideaText);
}

// Utility: classify only, return DNA + inferred validation strategy (Layer 1 output)
export async function classifyBusiness(ideaText: string) {
	const svc = new HybridValidationService();
	const dna = await (svc as any).classifier.classifyBusiness(ideaText);
	const weights = (svc as any).weightingEngine.getIndustryWeights(dna);
	const strategy = (svc as any).weightingEngine.describeStrategy(dna, weights);
	return { business_dna: dna, validation_strategy: strategy } as {
		business_dna: BusinessDNA;
		validation_strategy: ValidationStrategy;
	};
}
