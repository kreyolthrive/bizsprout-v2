// src/lib/hybridValidationFramework.ts
// Hybrid Business Validation System
// Combines dynamic business classification with rigorous mathematical scoring

import type { 
  ValidationInput, 
  ValidateResponse, 
  Scores, 
  QCRule, 
  RedFlag, 
  BusinessDNA,
  IndustryWeights,
  MarketIntelligence,
  CompetitiveIntelligence,
  HybridValidateResponse,
  ValidationContext
} from '../types/validation';

// ============================================================================
// COMPETITIVE INTELLIGENCE & MARKET SATURATION
// ============================================================================

class CompetitiveIntelligenceEngine {
  private crowdedMarkets: Map<string, CompetitiveIntelligence>;

  constructor() {
    this.initializeCrowdedMarkets();
  }

  // Add competitive intelligence for specific density analysis
  private assessCompetitiveDensity(dna: BusinessDNA, description: string): number {
    const crowdedMarkets = {
      'project-management': {
        incumbents: ['Monday.com', 'Asana', 'Notion', 'Trello', 'Jira'],
        marketSaturation: 0.9,
        entryDifficulty: 9
      },
      'crm': {
        incumbents: ['Salesforce', 'HubSpot', 'Pipedrive'],
        marketSaturation: 0.8,
        entryDifficulty: 8
      }
    };
    
    if (description.toLowerCase().includes('project management')) {
      return 1; // Very crowded
    }
    return 5; // Default
  }

  analyzeCompetitiveLandscape(ideaText: string, dna: BusinessDNA): CompetitiveIntelligence {
    const text = ideaText.toLowerCase();
    
    // Check for specific crowded markets
    for (const [pattern, intelligence] of this.crowdedMarkets.entries()) {
      if (this.matchesMarketPattern(text, pattern)) {
        return intelligence;
      }
    }

    // Default analysis for unrecognized markets
    return this.getDefaultCompetitiveAnalysis(dna);
  }

  private matchesMarketPattern(text: string, pattern: string): boolean {
    const patterns: Record<string, string[]> = {
      'project-management': [
        'project management', 'task management', 'team collaboration',
        'project tracking', 'workflow management', 'kanban', 'scrum',
        'team productivity', 'project planning'
      ],
      'crm': [
        'crm', 'customer relationship', 'sales pipeline', 'lead management',
        'customer management', 'sales tracking', 'contact management'
      ],
      'email-marketing': [
        'email marketing', 'newsletter', 'email automation', 'email campaigns',
        'drip campaigns', 'email sequences'
      ],
      'social-media-management': [
        'social media management', 'social media scheduling', 'social media automation',
        'instagram management', 'twitter scheduling', 'facebook posts'
      ],
      'video-conferencing': [
        'video conferencing', 'video calls', 'online meetings', 'virtual meetings',
        'zoom alternative', 'video chat'
      ],
      'password-management': [
        'password manager', 'password management', 'password storage',
        'credential management'
      ],
      'note-taking': [
        'note taking', 'note management', 'digital notes', 'notebook app',
        'knowledge management'
      ],
      'time-tracking': [
        'time tracking', 'time management', 'timesheet', 'productivity tracking',
        'work hours tracking'
      ]
    };

    const keywords = patterns[pattern] || [pattern];
    return keywords.some(keyword => text.includes(keyword));
  }

  private initializeCrowdedMarkets(): void {
    this.crowdedMarkets = new Map([
      ['project-management', {
        marketCategory: 'Project Management Software',
        incumbents: [
          'Monday.com ($11B+ valuation)',
          'Asana ($7B+ valuation)', 
          'Notion ($10B+ valuation)',
          'Trello (owned by Atlassian)',
          'Jira (Atlassian)',
          'ClickUp',
          'Airtable',
          'Slack (Salesforce)'
        ],
        marketSaturation: 0.95,
        entryDifficulty: 9,
        switchingCosts: 'low',
        networkEffects: 'weak',
        capitalRequirements: 'high',
        brandImportance: 'medium',
        confidence: 0.95
      }],
      ['crm', {
        marketCategory: 'Customer Relationship Management',
        incumbents: [
          'Salesforce ($200B+ market cap)',
          'HubSpot ($20B+ market cap)',
          'Pipedrive',
          'Zoho CRM',
          'Microsoft Dynamics',
          'Freshworks'
        ],
        marketSaturation: 0.85,
        entryDifficulty: 8,
        switchingCosts: 'high',
        networkEffects: 'weak',
        capitalRequirements: 'high',
        brandImportance: 'high',
        confidence: 0.90
      }],
      ['email-marketing', {
        marketCategory: 'Email Marketing Automation',
        incumbents: [
          'Mailchimp',
          'Constant Contact',
          'ConvertKit',
          'AWeber',
          'GetResponse',
          'ActiveCampaign'
        ],
        marketSaturation: 0.80,
        entryDifficulty: 7,
        switchingCosts: 'medium',
        networkEffects: 'none',
        capitalRequirements: 'medium',
        brandImportance: 'medium',
        confidence: 0.85
      }],
      ['social-media-management', {
        marketCategory: 'Social Media Management',
        incumbents: [
          'Hootsuite',
          'Buffer',
          'Sprout Social',
          'Later',
          'SocialBee',
          'Planoly'
        ],
        marketSaturation: 0.75,
        entryDifficulty: 6,
        switchingCosts: 'low',
        networkEffects: 'none',
        capitalRequirements: 'medium',
        brandImportance: 'low',
        confidence: 0.80
      }],
      ['video-conferencing', {
        marketCategory: 'Video Conferencing',
        incumbents: [
          'Zoom ($25B+ market cap)',
          'Microsoft Teams',
          'Google Meet',
          'WebEx (Cisco)',
          'GoToMeeting'
        ],
        marketSaturation: 0.90,
        entryDifficulty: 9,
        switchingCosts: 'medium',
        networkEffects: 'strong',
        capitalRequirements: 'high',
        brandImportance: 'high',
        confidence: 0.95
      }],
      ['password-management', {
        marketCategory: 'Password Management',
        incumbents: [
          '1Password',
          'LastPass',
          'Bitwarden',
          'Dashlane',
          'Keeper'
        ],
        marketSaturation: 0.70,
        entryDifficulty: 8,
        switchingCosts: 'high',
        networkEffects: 'none',
        capitalRequirements: 'medium',
        brandImportance: 'high',
        confidence: 0.85
      }],
      ['note-taking', {
        marketCategory: 'Note Taking & Knowledge Management',
        incumbents: [
          'Notion ($10B+ valuation)',
          'Obsidian',
          'Roam Research',
          'Evernote',
          'OneNote (Microsoft)',
          'Bear',
          'Logseq'
        ],
        marketSaturation: 0.80,
        entryDifficulty: 7,
        switchingCosts: 'medium',
        networkEffects: 'weak',
        capitalRequirements: 'medium',
        brandImportance: 'medium',
        confidence: 0.80
      }],
      ['time-tracking', {
        marketCategory: 'Time Tracking Software',
        incumbents: [
          'Toggl',
          'Harvest',
          'RescueTime',
          'Clockify',
          'Time Doctor',
          'DeskTime'
        ],
        marketSaturation: 0.70,
        entryDifficulty: 6,
        switchingCosts: 'low',
        networkEffects: 'none',
        capitalRequirements: 'low',
        brandImportance: 'low',
        confidence: 0.75
      }]
    ]);
  }

  private getDefaultCompetitiveAnalysis(dna: BusinessDNA): CompetitiveIntelligence {
    return {
      marketCategory: `${dna.industry} - ${dna.subIndustry}`,
      incumbents: [],
      marketSaturation: 0.5,
      entryDifficulty: 5,
      switchingCosts: 'medium',
      networkEffects: dna.networkEffects,
      capitalRequirements: dna.capitalIntensity,
      brandImportance: 'medium',
      confidence: 0.6
    };
  }
}

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
      'ecommerce': ['shop', 'store', 'retail', 'marketplace', 'buy', 'sell', 'product'],
      'saas': ['software', 'platform', 'tool', 'dashboard', 'api', 'service', 'management'],
      'beauty': ['skincare', 'makeup', 'cosmetics', 'beauty', 'hair', 'nail'],
      'food': ['restaurant', 'food', 'delivery', 'meal', 'recipe', 'cooking'],
      'travel': ['travel', 'booking', 'hotel', 'flight', 'vacation', 'trip'],
      'real-estate': ['property', 'real estate', 'housing', 'rent', 'buy home'],
      'entertainment': ['game', 'music', 'video', 'streaming', 'content', 'media']
    };

    let bestMatch = 'technology';
    let maxScore = 0;

    for (const [industry, keywords] of Object.entries(patterns)) {
      const score = keywords.reduce((acc, keyword) => 
        acc + (text.includes(keyword) ? 1 : 0), 0
      );
      if (score > maxScore) {
        maxScore = score;
        bestMatch = industry;
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
    const patterns = {
      'subscription': ['subscription', 'monthly', 'recurring', 'saas'],
      'marketplace': ['marketplace', 'platform', 'connect', 'two-sided'],
      'ecommerce': ['sell', 'product', 'inventory', 'shipping'],
      'freemium': ['free', 'premium', 'upgrade', 'basic plan'],
      'advertising': ['ads', 'advertising', 'sponsored', 'free app'],
      'transaction': ['commission', 'transaction fee', 'per transaction'],
      'service': ['service', 'consulting', 'done for you']
    };

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
      typeof v === 'string' && text.includes(v.toLowerCase())
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

class MarketIntelligenceEngine {
  async gatherMarketIntelligence(
    ideaDescription: string, 
    dna: BusinessDNA
  ): Promise<MarketIntelligence> {
    
    // Build industry-specific research prompts
    const prompt = this.buildMarketResearchPrompt(ideaDescription, dna);
    
    try {
      // This would integrate with your AI providers (Perplexity, Claude, etc.)
      const marketData = await this.callMarketResearchAPI(prompt, dna);
      return this.parseMarketData(marketData, dna);
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
    
    return this.generateRealisticMarketData(dna);
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
    return {
      tam_usd: data.tam_usd || 1_000_000_000,
      growth_rate: data.growth_rate || 0.1,
      competition_level: data.competition_level || 5,
      key_trends: data.key_trends || [],
      regulatory_barriers: data.regulatory_barriers || [],
      typical_margins: data.typical_margins || 0.5,
      customer_acquisition_difficulty: data.customer_acquisition_difficulty || 5,
      confidence: data.confidence || 0.7
    };
  }

  private getFallbackMarketData(dna: BusinessDNA): MarketIntelligence {
    return {
      tam_usd: 10_000_000_000,
      growth_rate: 0.08,
      competition_level: 5,
      key_trends: ['Market growth', 'Digital adoption'],
      regulatory_barriers: ['Standard business requirements'],
      typical_margins: 0.4,
      customer_acquisition_difficulty: 5,
      confidence: 0.3
    };
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

    if (dna.businessModel === 'subscription' || dna.industry === 'saas') {
      return {
        ...baseWeights,
        wtp: 12, // Critical for subscription success
        demand_signals: 16,
        market_quality: 12,
        differentiation: 12,
        gtm: 12
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
  economics: number;
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

  // Economics reality check - new entrants face higher CAC/churn in crowded markets
  private assessEconomicsReality(idea: string, pricing: number = 0): number {
    const crowdedMarkets = ['project management', 'crm', 'email marketing'];
    const isCrowded = crowdedMarkets.some(market => idea.toLowerCase().includes(market));
    
    if (isCrowded) {
      // In crowded markets, new entrants face 3-5x higher CAC
      // and 2-3x higher churn than established players
      const marketPremium = pricing > 50 ? 0.8 : 0.4; // Premium pricing helps
      return Math.max(2, 3 * marketPremium); // Cap at 2-3/10 for crowded markets
    }
    
    return 6; // Default for uncrowded markets
  }

  // Compute standalone economics score for unit economics viability
  private computeEconomicsScore(input: ValidationInput, intelligence: MarketIntelligence): number {
    const idea = input.idea_text || '';
    const pricing = this.nz(input.price_point, 0);
    
    // Base score starts neutral
    let economicsScore = 6;
    
    // BRUTAL market saturation penalties - the core issue
    const saturationPenalties = {
      'project management': 3.0, // From 6 to 3 = still brutal
      'task management': 3.0,
      'productivity': 2.5,
      'collaboration': 2.5,
      'crm': 2.5,
      'email marketing': 2.5,
      'kanban': 3.0, // Specifically saturated
      'workflow': 2.0
    };
    
    let maxSaturationPenalty = 0;
    for (const [market, penalty] of Object.entries(saturationPenalties)) {
      if (idea.toLowerCase().includes(market)) {
        maxSaturationPenalty = Math.max(maxSaturationPenalty, penalty);
      }
    }
    
    // Apply the maximum saturation penalty found
    economicsScore = Math.max(2, economicsScore - maxSaturationPenalty); // Floor at 2 instead of 1
    
    // Extreme competition density penalty
    const competitionDensity = this.nz(input.competition_density, 5);
    if (competitionDensity >= 8) {
      economicsScore = Math.min(economicsScore, 3); // Cap at 3/10 for extreme density
    }
    
    // Generic features = commoditization = price pressure
    const genericTerms = ['dashboard', 'analytics', 'reporting', 'integration', 'automation', 'board', 'tracking'];
    const genericCount = genericTerms.filter(term => idea.toLowerCase().includes(term)).length;
    if (genericCount >= 3) {
      economicsScore = Math.max(2, economicsScore - 0.5); // Lighter penalty, floor at 2
    }
    
    // Low pricing indicates unsustainable unit economics
    if (pricing > 0 && pricing < 35) {
      economicsScore = Math.max(1.5, economicsScore - 1.0); // Brutal penalty for low pricing
      if (pricing <= 29 && (idea.toLowerCase().includes('project management') || idea.toLowerCase().includes('kanban'))) {
        economicsScore = Math.max(1, economicsScore - 0.5); // Extra penalty for PM software at typical pricing
      }
    }
    
    // High customer acquisition difficulty destroys economics
    const cac_difficulty = intelligence?.customer_acquisition_difficulty || 5;
    if (cac_difficulty >= 7) {
      economicsScore = Math.max(1.5, economicsScore - 1.0); // Brutal penalty for high CAC
    }
    
    return this.clamp(economicsScore);
  }

  // Apply market saturation effects across all scoring dimensions
  private applyMarketSaturationEffects(scores: any, saturationLevel: number): any {
    if (saturationLevel > 0.8) { // Highly saturated (>80%)
      return {
        ...scores,
        problem: Math.min(scores.problem, 6), // Cap demand in saturated markets
        gtm: Math.min(scores.gtm, 3), // Very hard to distribute
        wtp: Math.min(scores.wtp, 3), // Poor economics for new entrants  
        differentiation: Math.min(scores.differentiation, 4) // Hard to build moat in established market
      };
    }
    return scores;
  }

  computeScores(
    input: ValidationInput,
    dna: BusinessDNA,
    marketData: MarketIntelligence,
    weights: IndustryWeights,
    competitiveIntel?: CompetitiveIntelligence
  ): ComputedScores {
    
    // Base scoring (from original framework)
    const baseScores = this.computeBaseScores(input);
    
    // Enhanced market quality using real data
    const enhancedMarketQuality = this.computeEnhancedMarketQuality(
      input, marketData, dna, competitiveIntel
    );

    // CRITICAL FIX: Apply competitive saturation penalties
    const competitiveAdjustments = competitiveIntel ? 
      this.applyCompetitiveSaturationPenalties(baseScores, competitiveIntel, dna) : 
      { ...baseScores };

    // Business-specific scoring
    const businessSpecificScores = this.computeBusinessSpecificScores(
      input, dna, marketData
    );

    // Compute economics score - critical for new entrant viability
    const economicsScore = this.computeEconomicsScore(input, marketData);

    const allScores = {
      ...competitiveAdjustments, // Use adjusted scores instead of base
      market_quality: enhancedMarketQuality,
      economics: economicsScore,
      ...businessSpecificScores
    };

    // Apply market saturation effects across all dimensions
    const saturationLevel = competitiveIntel ? competitiveIntel.marketSaturation : 0;
    const saturationAdjustedScores = this.applyMarketSaturationEffects(allScores, saturationLevel);

    // Calculate weighted overall score
    let overall = this.calculateWeightedScore(saturationAdjustedScores, weights);
    
    // CRITICAL: Apply competitive penalties to the overall score
    if (competitiveIntel) {
      const saturationPenalty = competitiveIntel.marketSaturation * 12; // Up to 12% penalty 
      const difficultyPenalty = Math.max(0, competitiveIntel.entryDifficulty - 7) * 2; // Penalty for difficulty > 7
      
      overall = Math.max(10, Math.round(overall - saturationPenalty - difficultyPenalty)); // Minimum 10%, rounded
    }

    return {
      ...saturationAdjustedScores,
      overall
    };
  }

  // CRITICAL NEW METHOD: Apply penalties for oversaturated markets
  private applyCompetitiveSaturationPenalties(
    baseScores: any,
    competitiveIntel: CompetitiveIntelligence,
    dna: BusinessDNA
  ) {
    const saturationPenalty = competitiveIntel.marketSaturation;
    const entryDifficultyPenalty = competitiveIntel.entryDifficulty / 10;

    // Calculate dramatic penalties for oversaturated markets
    const demandPenalty = saturationPenalty > 0.8 ? 
      Math.max(0.1, 1 - (saturationPenalty * 1.5)) : // Cap at 90% reduction for very saturated markets
      Math.max(0.3, 1 - saturationPenalty); // Less severe for moderately saturated

    const differentiationPenalty = entryDifficultyPenalty > 0.7 ?
      Math.max(0.1, 1 - entryDifficultyPenalty) :
      Math.max(0.4, 1 - (entryDifficultyPenalty * 0.8));

    return {
      ...baseScores,
      // MASSIVE penalties for oversaturated markets
      demand_signals: baseScores.demand_signals * demandPenalty,
      differentiation: baseScores.differentiation * differentiationPenalty,
      // Also penalize market quality for crowded spaces
      market_quality: baseScores.market_quality * Math.max(0.2, 1 - (saturationPenalty * 0.8)),
      // Higher execution requirements in crowded markets
      execution: baseScores.execution * Math.max(0.5, 1 - (entryDifficultyPenalty * 0.5))
    };
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

    // Enhanced differentiation scoring with brutal market reality
    const attr = input.attributes || {};
    const attrDiff = (
      this.nz(attr.Disruptive, 0) * 0.35 +
      this.nz(attr.Defensible, 0) * 0.35 +
      this.nz(attr.Discontinuous, 0) * 0.15 +
      ((this.nz(attr.SocialNeed) + this.nz(attr.Growth) + this.nz(attr.Achievement)) / 3) * 0.15
    ) / 1.0;

    // CRITICAL FIX: competition_density should REDUCE differentiation, not increase it!
    let baseDifferentiation = (
      (10 - normalizeYesNo(input.competition_density)) * 0.5 + 
      this.clamp(attrDiff) * 0.5
    );

    // BRUTAL penalties for commoditized features in saturated markets
    const idea = input.idea_text || '';
    const genericFeaturePenalties = {
      'kanban': 4.0,           // Boards are commodity now
      'task tracking': 3.5,    // Every tool has this
      'dashboard': 3.0,        // Standard feature
      'slack integration': 3.5, // Table stakes
      'google integration': 3.0, // Expected feature
      'analytics': 3.0,        // Standard reporting
      'automation': 2.5,       // Common feature
      'workflow': 2.5          // Generic capability
    };

    let maxGenericPenalty = 0;
    for (const [feature, penalty] of Object.entries(genericFeaturePenalties)) {
      if (idea.toLowerCase().includes(feature)) {
        maxGenericPenalty = Math.max(maxGenericPenalty, penalty);
      }
    }

    // Apply the maximum generic feature penalty - these are NOT moats
    baseDifferentiation = Math.max(0.5, baseDifferentiation - maxGenericPenalty);

    // Additional penalty for project management space specifically
    if (idea.toLowerCase().includes('project management')) {
      baseDifferentiation = Math.max(0.3, baseDifferentiation - 2.0); // Extra penalty for PM
    }

    const differentiation = this.clamp(baseDifferentiation);

    // Demand signals
    const interviews = this.clamp(this.nz(input.interviews, 0) >= 10 ? 6 : this.nz(input.interviews, 0) / 2);
    const pos = this.clamp(Math.round(this.nz(input.interviews_positive_pct, 0) / 10));
    const wlConv = this.clamp(Math.round(this.nz(input.waitlist_conv_rate_pct, 0) / 10));
    const lois = this.clamp(this.nz(input.lois, 0) > 5 ? 6 : this.nz(input.lois, 0));
    const pre = this.clamp(this.nz(input.preorders, 0) > 20 ? 10 : this.nz(input.preorders, 0) / 2);

    const demand_signals = this.clamp(
      interviews * 0.25 + pos * 0.2 + wlConv * 0.25 + lois * 0.15 + pre * 0.15
    );

    // WTP - Apply economics reality check for crowded markets
    const baseWtp = this.clamp(
      normalizeYesNo(input.willingness_to_pay) * 0.7 +
      this.clamp(this.nz(input.price_point, 0) > 0 ? 7 : 0) * 0.3
    );
    
    // Factor in realistic economics for crowded markets
    const economicsReality = this.assessEconomicsReality(input.idea_text || '', this.nz(input.price_point, 0));
    const economicsMultiplier = economicsReality / 6; // Normalize against default score of 6
    const wtp = this.clamp(baseWtp * economicsMultiplier);

    // GTM
    const ltv = this.nz(input.ltv_estimate, 0);
    const cac = this.nz(input.cac_estimate, 0);
    const ltv_cac_ok = ltv > 0 && cac > 0 ? ltv / cac >= 3 : undefined;

    // GTM - Factor in economics reality for customer acquisition difficulty
    const baseGtm = this.clamp(
      normalizeYesNo(input.channels_clarity) * 0.6 +
      this.clamp(ltv_cac_ok === undefined ? 5 : ltv_cac_ok ? 9 : 2) * 0.4
    );
    
    // Apply economics reality penalty to GTM (reflects higher CAC in crowded markets)
    const gtm = this.clamp(baseGtm * economicsMultiplier);

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
    dna: BusinessDNA,
    competitiveIntel?: CompetitiveIntelligence
  ): number {
    // Combine user input with real market data
    const userTamQuality = this.nz(input.tam_quality, 5);
    const userGrowthQuality = this.nz(input.growth_rate_quality, 5);
    
    // Score market data
    const tamScore = this.scoreTAM(marketData.tam_usd, dna);
    const growthScore = this.scoreGrowthRate(marketData.growth_rate);
    const competitionScore = marketData.competition_level; // Already 0-10 scale
    
    // CRITICAL: This should measure ADDRESSABLE opportunity, not just market size
    // High demand in oversaturated markets = low opportunity for new entrants
    let addressableOpportunity = this.clamp(
      (userTamQuality * 0.2 + tamScore * 0.3) +
      (userGrowthQuality * 0.2 + growthScore * 0.2) +
      (competitionScore * 0.1)
    );
    
    // Apply severe penalties for oversaturated markets with dominant incumbents
    // This converts "market demand" into "addressable opportunity for new entrants"
    if (competitiveIntel) {
      const saturation = competitiveIntel.marketSaturation;
      const entryDifficulty = competitiveIntel.entryDifficulty;
      const incumbentCount = competitiveIntel.incumbents.length;
      
      // Severe penalty for oversaturated markets (PM, CRM, etc.)
      if (saturation >= 0.9 && entryDifficulty >= 8) {
        addressableOpportunity = Math.min(addressableOpportunity, 2); // Cap at 2/10
      } else if (saturation >= 0.8 && entryDifficulty >= 7) {
        addressableOpportunity = Math.min(addressableOpportunity, 3); // Cap at 3/10
      } else if (saturation >= 0.7 && incumbentCount >= 5) {
        addressableOpportunity = Math.min(addressableOpportunity, 4); // Cap at 4/10
      }
    }
    
    return addressableOpportunity;
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
      const score = scores[dimension as keyof ComputedScores];
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

  constructor() {
    this.initializeRules();
  }

  makeDecision(
    scores: ComputedScores,
    dna: BusinessDNA,
    marketData: MarketIntelligence,
    input: ValidationInput,
    competitiveIntel?: CompetitiveIntelligence
  ): {
    status: ValidateResponse['status'];
    reasoning: string;
    risks: string[];
    highlights: string[];
  } {
    const context = { scores, dna, marketData, input };
    
    // CRITICAL: Check for oversaturated markets first
    if (competitiveIntel && competitiveIntel.marketSaturation > 0.8) {
      // Even in oversaturated markets, check market reality red flags
      const industryRedFlags = this.getIndustryRedFlags(dna);
      const triggeredRedFlags = industryRedFlags.filter(flag => flag.when(context));
      
      return {
        status: 'NO-GO',
        reasoning: `Entering oversaturated ${competitiveIntel.marketCategory} market (${Math.round(competitiveIntel.marketSaturation * 100)}% saturated) with ${competitiveIntel.incumbents.length} major incumbents including ${competitiveIntel.incumbents.slice(0, 2).join(', ')}. Entry difficulty: ${competitiveIntel.entryDifficulty}/10.`,
        risks: [
          `Market oversaturation: ${competitiveIntel.marketCategory} has ${competitiveIntel.incumbents.length} established players`,
          `High entry barriers: ${competitiveIntel.entryDifficulty}/10 difficulty score`,
          `Major incumbents: ${competitiveIntel.incumbents.slice(0, 3).join(', ')}`,
          ...triggeredRedFlags.map(r => r.message),
          ...this.getCompetitiveRisks(competitiveIntel)
        ],
        highlights: []
      };
    }

    // Check industry-specific red flags
    const industryRedFlags = this.getIndustryRedFlags(dna);
    const triggeredRedFlags = industryRedFlags.filter(flag => flag.when(context));
    const killers = triggeredRedFlags.filter(flag => flag.kill);

    // Check industry-specific QC rules  
    const industryQCRules = this.getIndustryQCRules(dna);
    const triggeredQC = industryQCRules.filter(rule => rule.when(context));

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
    const recommendation = this.determineRecommendation(scores, dna, marketData, competitiveIntel);
    const highlights = this.generateHighlights(scores, dna);

    return {
      status: recommendation.status,
      reasoning: recommendation.reasoning,
      risks: [...triggeredRedFlags.map(r => r.message), ...triggeredQC.map(q => q.message)],
      highlights
    };
  }

  private getCompetitiveRisks(competitiveIntel: CompetitiveIntelligence): string[] {
    const risks: string[] = [];
    
    if (competitiveIntel.switchingCosts === 'high') {
      risks.push('High customer switching costs favor incumbents');
    }
    
    if (competitiveIntel.networkEffects === 'strong') {
      risks.push('Strong network effects create winner-take-all dynamics');
    }
    
    if (competitiveIntel.capitalRequirements === 'high') {
      risks.push('High capital requirements for competitive feature parity');
    }

    return risks;
  }

  private determineRecommendation(
    scores: ComputedScores,
    dna: BusinessDNA,
    marketData: MarketIntelligence,
    competitiveIntel?: CompetitiveIntelligence
  ): { status: ValidateResponse['status']; reasoning: string } {
    
    let overall = scores.overall;
    
    // Competitive penalties now applied during scoring, not here
    
    // Industry-specific thresholds
    const thresholds = this.getIndustryThresholds(dna);
    
    if (overall >= thresholds.go) {
      return {
        status: 'GO',
        reasoning: `Strong validation across key dimensions with ${overall}% overall score. ${dna.industry} market conditions favorable.${competitiveIntel ? ` Competitive analysis factored in.` : ''}`
      };
    }
    
    if (overall >= thresholds.review) {
      const weakAreas = this.identifyWeakAreas(scores, dna);
      return {
        status: 'REVIEW',
        reasoning: `Moderate potential (${overall}%) but address: ${weakAreas.join(', ')}${competitiveIntel ? `. Competitive challenges noted.` : ''}`
      };
    }
    
    return {
      status: 'NO-GO',
      reasoning: `Significant challenges with ${overall}% score.${competitiveIntel ? ` Competitive pressure too high.` : ''} Consider pivot or alternative approach.`
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
    if (scores.network_effects && scores.network_effects >= 8) {
      highlights.push('Strong network effects potential');
    }
    
    if (scores.viral_potential && scores.viral_potential >= 7) {
      highlights.push('High viral growth potential');
    }

    return highlights;
  }

  private getIndustryRedFlags(dna: BusinessDNA): RedFlag[] {
    const baseFlags: RedFlag[] = [
      {
        id: 'illegal',
        when: (ctx) => !!ctx.input.illegal_or_prohibited,
        message: 'Illegal or prohibited domain',
        kill: true
      },
      {
        id: 'no-problem',
        when: (ctx) => ctx.scores.problem < 3 && ctx.scores.underserved < 3,
        message: 'No compelling problem identified',
        kill: true
      },
      {
        id: 'impossible',
        when: (ctx) => ctx.scores.feasibility < 2,
        message: 'Not feasible with reasonable resources',
        kill: true
      }
    ];

    // Enhanced Market Reality Red Flags
    const MARKET_REALITY_FLAGS: RedFlag[] = [
      {
        id: 'incumbent-domination',
        when: (ctx) => ctx.input.idea_text?.toLowerCase().includes('project management') || 
                       ctx.input.idea_text?.toLowerCase().includes('crm') || 
                       ctx.input.idea_text?.toLowerCase().includes('email marketing'),
        message: 'Market dominated by billion-dollar incumbents with strong network effects',
        kill: false
      },
      {
        id: 'generic-feature-set',
        when: (ctx) => ctx.scores.differentiation < 3 && (ctx.input.competition_density || 10) < 3,
        message: 'Generic features in crowded market - unclear path to customer acquisition',
        kill: false
      },
      {
        id: 'pricing-unrealistic',
        when: (ctx) => ctx.input.idea_text?.includes('$29') && ctx.input.idea_text?.toLowerCase().includes('project management'),
        message: 'Pricing below market leaders suggests unsustainable unit economics',
        kill: false
      }
    ];

    baseFlags.push(...MARKET_REALITY_FLAGS);

    // Add industry-specific red flags
    if (dna.industry === 'fintech') {
      baseFlags.push({
        id: 'regulatory-nightmare',
        when: (ctx) => (ctx.input.regulatory_risk || 0) >= 8 && (ctx.input.team_experience || 0) < 4,
        message: 'High regulatory risk without domain expertise',
        kill: true
      });
    }

    if (dna.customerType === 'marketplace') {
      baseFlags.push({
        id: 'chicken-egg-unsolved',
        when: (ctx) => ctx.scores.supply_demand_balance && ctx.scores.supply_demand_balance < 3,
        message: 'No clear solution to marketplace chicken-and-egg problem',
        kill: false
      });
    }

    return baseFlags;
  }

  private getIndustryQCRules(dna: BusinessDNA): QCRule[] {
    const baseRules: QCRule[] = [
      {
        id: 'low-urgency',
        when: (ctx) => ctx.scores.problem < 4,
        message: 'Low customer urgency - validate problem intensity',
        severity: 'med'
      },
      {
        id: 'weak-demand',
        when: (ctx) => ctx.scores.demand_signals < 5,
        message: 'Insufficient demand validation - run more customer interviews',
        severity: 'high'
      }
    ];

    // Add industry-specific QC rules
    if (dna.businessModel === 'subscription') {
      baseRules.push({
        id: 'subscription-retention-risk',
        when: (ctx) => ctx.scores.wtp < 6 && ctx.scores.problem < 7,
        message: 'Subscription model requires strong value proposition',
        severity: 'high'
      });
    }

    if (dna.networkEffects === 'strong') {
      baseRules.push({
        id: 'network-effects-strategy',
        when: (ctx) => ctx.scores.viral_potential && ctx.scores.viral_potential < 5,
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
  private competitiveEngine: CompetitiveIntelligenceEngine;

  constructor() {
    this.classifier = new BusinessClassifier();
    this.marketEngine = new MarketIntelligenceEngine();
    this.weightingEngine = new WeightingEngine();
    this.scoringEngine = new EnhancedScoringEngine();
    this.decisionEngine = new EnhancedDecisionEngine();
    this.competitiveEngine = new CompetitiveIntelligenceEngine();
  }

  async validateBusinessIdea(input: ValidationInput): Promise<HybridValidateResponse> {
    try {
      // Step 1: Classify business DNA
      const dna = await this.classifier.classifyBusiness(input.idea_text);
      
      if (dna.confidence < 0.4) {
        throw new Error('Unable to clearly classify business type. Please provide more specific details.');
      }

      // Step 2: Analyze competitive landscape (CRITICAL FIX)
      const competitiveIntel = this.competitiveEngine.analyzeCompetitiveLandscape(input.idea_text, dna);

      // Step 3: Gather market intelligence
      const marketData = await this.marketEngine.gatherMarketIntelligence(input.idea_text, dna);
      
      // Step 4: Get industry-specific weights
      const weights = this.weightingEngine.getIndustryWeights(dna);
      
      // Step 5: Compute enhanced scores WITH competitive reality
      const scores = this.scoringEngine.computeScores(input, dna, marketData, weights, competitiveIntel);
      
      // Step 6: Make decision with business context AND competitive reality
      const decision = this.decisionEngine.makeDecision(scores, dna, marketData, input, competitiveIntel);
      
      // Step 7: Generate result
      const result = this.generateValidationResult(input, dna, marketData, scores, decision, competitiveIntel);
      
      return {
        ...result,
        business_dna: dna,
        market_intelligence: marketData,
        competitive_intelligence: competitiveIntel,
        methodology_explanation: this.generateMethodologyExplanation(dna, weights, competitiveIntel)
      };
      
    } catch (error) {
      console.error('Hybrid validation failed:', error);
      throw new Error(`Validation failed: ${error.message}`);
    }
  }

  // CRITICAL: Hardcoded reality checks for obviously problematic business categories
  private applyRealityCheckOverrides(scores: ComputedScores, input: ValidationInput): ComputedScores {
    const idea = input.idea_text?.toLowerCase() || '';
    
    // Helper function to check for generic features
    const hasGenericFeatures = (ideaText: string): boolean => {
      const genericFeatures = [
        'kanban', 'dashboard', 'analytics', 'integration', 
        'slack integration', 'google integration', 'automation',
        'task tracking', 'workflow', 'reporting'
      ];
      return genericFeatures.some(feature => ideaText.includes(feature));
    };

    // Add specific overrides for known problematic categories
    if (idea.includes('project management') && hasGenericFeatures(idea)) {
      return {
        ...scores,
        differentiation: Math.min(scores.differentiation, 2),  // Max 2/10 for generic PM
        economics: Math.min(scores.economics, 3),             // Max 3/10 for oversaturated market
        demand_signals: Math.min(scores.demand_signals, 3),   // Max 3/10 for saturated demand
        market_quality: Math.min(scores.market_quality, 2),   // Very poor addressable opportunity
        overall: Math.min(scores.overall, 20)                 // Cap overall at 20%
      };
    }

    // CRM software reality check
    if ((idea.includes('crm') || idea.includes('customer relationship')) && hasGenericFeatures(idea)) {
      return {
        ...scores,
        differentiation: Math.min(scores.differentiation, 2),
        economics: Math.min(scores.economics, 3),
        demand_signals: Math.min(scores.demand_signals, 3),
        market_quality: Math.min(scores.market_quality, 3),
        overall: Math.min(scores.overall, 25)
      };
    }

    // Email marketing reality check
    if (idea.includes('email marketing') && hasGenericFeatures(idea)) {
      return {
        ...scores,
        differentiation: Math.min(scores.differentiation, 2),
        economics: Math.min(scores.economics, 3),
        demand_signals: Math.min(scores.demand_signals, 4),
        overall: Math.min(scores.overall, 30)
      };
    }

    // Social media management reality check
    if ((idea.includes('social media') && idea.includes('management')) && hasGenericFeatures(idea)) {
      return {
        ...scores,
        differentiation: Math.min(scores.differentiation, 3),
        economics: Math.min(scores.economics, 4),
        demand_signals: Math.min(scores.demand_signals, 4),
        overall: Math.min(scores.overall, 35)
      };
    }

    // Video conferencing reality check (extremely saturated)
    if (idea.includes('video conferencing') || idea.includes('video calls')) {
      return {
        ...scores,
        differentiation: Math.min(scores.differentiation, 1),  // Zoom, Teams domination
        economics: Math.min(scores.economics, 2),             // Impossible unit economics
        demand_signals: Math.min(scores.demand_signals, 2),   // Market solved
        market_quality: Math.min(scores.market_quality, 1),   // No addressable opportunity
        overall: Math.min(scores.overall, 15)                 // Brutal reality
      };
    }

    // Password management reality check
    if (idea.includes('password') && hasGenericFeatures(idea)) {
      return {
        ...scores,
        differentiation: Math.min(scores.differentiation, 2),
        economics: Math.min(scores.economics, 3),
        demand_signals: Math.min(scores.demand_signals, 3),
        overall: Math.min(scores.overall, 25)
      };
    }

    // Generic SaaS tools with standard features
    if (idea.includes('saas') && hasGenericFeatures(idea)) {
      const genericFeatureCount = [
        'kanban', 'dashboard', 'analytics', 'integration', 
        'automation', 'workflow', 'reporting'
      ].filter(feature => idea.includes(feature)).length;
      
      if (genericFeatureCount >= 3) {
        return {
          ...scores,
          differentiation: Math.min(scores.differentiation, 3),
          economics: Math.min(scores.economics, 4),
          overall: Math.min(scores.overall, 40)
        };
      }
    }

    return scores; // No overrides needed
  }

  private generateValidationResult(
    input: ValidationInput,
    dna: BusinessDNA,
    marketData: MarketIntelligence,
    computedScores: ComputedScores,
    decision: any,
    competitiveIntel?: CompetitiveIntelligence
  ): ValidateResponse {
    
    // CRITICAL: Hardcoded reality checks for obviously problematic business categories
    const finalScores = this.applyRealityCheckOverrides(computedScores, input);
    
    // Convert computed scores to API format
    const scores: Scores = {
      problem: this.round1(finalScores.problem),
      underserved: this.round1(finalScores.underserved),
      feasibility: this.round1(finalScores.feasibility),
      differentiation: this.round1(finalScores.differentiation),
      demand_signals: this.round1(finalScores.demand_signals),
      willingness_to_pay: this.round1(finalScores.wtp),
      market_quality: this.round1(finalScores.market_quality),
      gtm: this.round1(finalScores.gtm),
      execution: this.round1(finalScores.execution),
      risk: this.round1(finalScores.risk),
      economics: this.round1(finalScores.economics),
      overall: finalScores.overall
    };

    // Add business-specific scores
    if (finalScores.network_effects !== undefined) {
      scores.network_effects = this.round1(finalScores.network_effects);
    }
    if (finalScores.regulatory_compliance !== undefined) {
      scores.regulatory_compliance = this.round1(finalScores.regulatory_compliance);
    }

    // Generate value proposition
    const value_prop = this.generateValueProposition(input, dna, marketData);
    
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
    dna: BusinessDNA,
    marketData: MarketIntelligence
  ): string {
    const ideaCore = input.idea_text || 'This business';
    const targetCustomer = input.target_customer || 
                          (dna.customerType === 'b2b' ? 'businesses' : 'consumers');
    
    let valueDriver = '';
    if (marketData.key_trends.length > 0) {
      valueDriver = `capitalizes on ${marketData.key_trends[0].toLowerCase()}`;
    } else if (dna.networkEffects === 'strong') {
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

  private generateMethodologyExplanation(
    dna: BusinessDNA, 
    weights: IndustryWeights, 
    competitiveIntel?: CompetitiveIntelligence
  ): string {
    const keyFactors = Object.entries(weights)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 3)
      .map(([factor, weight]) => `${factor} (${weight}%)`)
      .join(', ');

    let explanation = `Validation adapted for ${dna.industry} ${dna.businessModel} business. Key factors: ${keyFactors}. Confidence: ${Math.round(dna.confidence * 100)}%`;
    
    if (competitiveIntel) {
      explanation += ` Competitive analysis: ${competitiveIntel.marketCategory} market with ${Math.round(competitiveIntel.marketSaturation * 100)}% saturation and ${competitiveIntel.entryDifficulty}/10 entry difficulty.`;
    }
    
    return explanation;
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
    const dummyClassifier = new BusinessClassifier();
    // Quick classification for demo defaults
    const quickDNA = {
      industry: ideaText.toLowerCase().includes('software') ? 'saas' : 'general',
      customerType: ideaText.toLowerCase().includes('business') ? 'b2b' : 'b2c'
    };

    // Realistic attribute defaults based on idea content
    const lowerIdea = ideaText.toLowerCase();
    
    // Check for generic saturated markets
    const isGenericPM = lowerIdea.includes('project management') || lowerIdea.includes('kanban') || lowerIdea.includes('task tracking');
    const isGenericCRM = lowerIdea.includes('crm') || lowerIdea.includes('customer relationship');
    const isGenericTool = isGenericPM || isGenericCRM || lowerIdea.includes('dashboard') || lowerIdea.includes('analytics');
    
    // Brutal reality for generic tools in saturated markets
    const attributes = isGenericTool ? {
      Disruptive: 1,    // Generic tools are not disruptive
      Defensible: 1,    // No defensible moats for commodity features
      Growth: 2,        // Limited growth potential in saturated markets
      Discontinuous: 1, // Incremental improvements, not breakthrough
      SocialNeed: 3,    // Basic business need
      Achievement: 3    // Standard business achievement
    } : {
      // Default for non-generic ideas
      Disruptive: 4,
      Defensible: 3,
      Growth: 4,
      Discontinuous: 3,
      SocialNeed: 4,
      Achievement: 4
    };

    return {
      idea_text: ideaText,
      b2x: quickDNA.customerType === 'b2b' ? 'B2B' : 'B2C',
      // Conservative defaults that will be enhanced by real market data
      unavoidable: isGenericTool ? 4 : 6,     // Lower urgency for generic tools
      urgency: isGenericTool ? 3 : 6,         // Generic tools solve already-solved problems
      underserved: isGenericTool ? 2 : 6,     // Saturated markets are well-served
      feasibility: 7,
      pain_gain_ratio: isGenericTool ? 3 : 6, // Lower value prop for generic tools
      whitespace: isGenericTool ? 1 : 6,      // No whitespace in saturated markets
      tam_quality: 6,
      growth_rate_quality: 6,
      competition_density: isGenericTool ? 9 : 5, // Extreme competition for generic tools
      willingness_to_pay: isGenericTool ? 3 : 6,  // Price pressure in commoditized markets
      channels_clarity: quickDNA.customerType === 'b2b' ? 6 : 5,
      team_experience: 6,
      capital_runway_months: 8,
      regulatory_risk: 3,
      platform_dependency_risk: 4,
      safety_risk: 2,
      attributes: attributes
    };
  }
}

// ============================================================================
// USAGE FUNCTIONS
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