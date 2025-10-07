// Contextual Pivot Analysis (business-model aware)
// Library: business model detection, pivot catalogs, scoring, generation, and validation

export enum BusinessModelType {
  SAAS_B2B = 'saas-b2b',
  ENTERPRISE_SAAS = 'enterprise-saas',
  MARKETPLACE = 'marketplace',
  PHYSICAL_PRODUCT = 'physical-product',
  DTC_SUBSCRIPTION = 'dtc-subscription',
  SERVICES = 'services',
  FINTECH = 'fintech',
  HEALTHCARE = 'healthcare',
  EDTECH = 'edtech'
  , MOBILE_APP = 'mobile-app'
  , FOOD_SERVICE = 'food-service'
}

export interface BusinessModelClassification {
  primaryType: BusinessModelType;
  subType?: string;
  confidence: number; // 0..1
  indicators: string[];
  constraints: string[];
  reasoningChain?: string[];
}

function constraintsForModel(model: BusinessModelType): string[] {
  switch (model) {
    case BusinessModelType.ENTERPRISE_SAAS:
      return ['long sales cycles', 'enterprise compliance', 'security reviews', 'integration complexity'];
    case BusinessModelType.MOBILE_APP:
      return ['app store policies', 'retention/DAU', 'acquisition costs'];
    case BusinessModelType.FOOD_SERVICE:
      return ['food safety regulations', 'delivery/logistics', 'platform commission costs'];
    case BusinessModelType.PHYSICAL_PRODUCT:
      return ['inventory management', 'shipping costs', 'material sourcing', 'seasonal demand'];
    case BusinessModelType.MARKETPLACE:
      return ['chicken-egg problem', 'disintermediation risk', 'platform network effects'];
    case BusinessModelType.SAAS_B2B:
      return ['customer acquisition cost', 'feature parity', 'switching costs'];
    case BusinessModelType.DTC_SUBSCRIPTION:
      return ['churn rates', 'shipping costs', 'inventory management'];
    case BusinessModelType.FINTECH:
      return ['compliance/licensing', 'fraud risk', 'capital constraints'];
    case BusinessModelType.HEALTHCARE:
      return ['HIPAA/PHI', 'clinical validation', 'integration with EHR'];
    case BusinessModelType.EDTECH:
      return ['district procurement', 'engagement/retention', 'seasonality'];
    case BusinessModelType.SERVICES:
    default:
      return ['market saturation', 'competitive pressure'];
  }
}

export function detectBusinessModelWithPriority(ideaText: string): BusinessModelClassification {
  const text = (ideaText || '').toLowerCase();

  const init = () => ({ score: 0, indicators: [] as string[], reasoning: [] as string[] });
  const scores = {
    [BusinessModelType.ENTERPRISE_SAAS]: init(),
    [BusinessModelType.FOOD_SERVICE]: init(),
    [BusinessModelType.DTC_SUBSCRIPTION]: init(),
    [BusinessModelType.PHYSICAL_PRODUCT]: init(),
    [BusinessModelType.MARKETPLACE]: init(),
    [BusinessModelType.SAAS_B2B]: init(),
    [BusinessModelType.SERVICES]: init(),
    [BusinessModelType.FINTECH]: init(),
    [BusinessModelType.HEALTHCARE]: init(),
    [BusinessModelType.EDTECH]: init(),
    [BusinessModelType.MOBILE_APP]: init(),
  } as Record<BusinessModelType, { score: number; indicators: string[]; reasoning: string[] }>;

  const addHits = (
    type: BusinessModelType,
    indicators: Array<{ term: string | RegExp; weight: number; reason: string; label?: string }>
  ) => {
    for (const ind of indicators) {
      const found = typeof ind.term === 'string' ? text.includes(ind.term) : ind.term.test(text);
      if (found) {
        scores[type].score += ind.weight;
        // Prefer a human-readable label for regex or complex terms
        if (ind.label) {
          scores[type].indicators.push(ind.label);
        } else {
          scores[type].indicators.push(typeof ind.term === 'string' ? ind.term : String(ind.term));
        }
        scores[type].reasoning.push(ind.reason);
      }
    }
  };

  // Strong PHYSICAL_PRODUCT intent override (pre-pass)
  // If user explicitly talks about selling/making tangible accessories with shipping and/or unit economics,
  // treat it as a physical goods business with high confidence.
  const physicalCategory = /(bag|bags|handbag|handbags|purse|purses|tote|totes|wallet|wallets|belt|belts|accessor(?:y|ies)|leather|leather\s+goods)/i.test(text);
  const sellOrMake = /\b(sell|selling|make|making|manufactur(?:e|ing)|produce|producing)\b/i.test(text);
  const hasShipping = /\b(ship|shipping|deliver|fulfillment|worldwide)\b/i.test(text);
  const hasCOGS = /\b(cogs|unit\s*cost|cost\s*to\s*make|costs?\s*\$?\d)/i.test(text);
  const hasPriceRange = /\$?\s?\d{2,4}\s*[-–]\s*\$?\s?\d{2,4}/.test(text) || /\$\s?\d{2,4}/.test(text);
  const strongPhysicalIntent = physicalCategory && (sellOrMake || hasShipping || hasCOGS || hasPriceRange);

  // Mobile app (highly specific)
  addHits(BusinessModelType.MOBILE_APP, [
    { term: /\bmobile app\b|\bios\b|\bandroid\b/i, weight: 8, reason: 'mobile platform keywords', label: 'mobile app' },
    { term: /app store|play store/i, weight: 6, reason: 'distribution via app stores', label: 'app store' },
    // Consumer vertical signals
    { term: 'fitness', weight: 8, reason: 'consumer fitness vertical' },
    { term: 'workout', weight: 7, reason: 'consumer fitness vertical' },
    { term: 'nutrition', weight: 7, reason: 'consumer wellness vertical' },
    { term: 'meal planning', weight: 7, reason: 'consumer wellness vertical' },
    { term: 'personal trainer', weight: 7, reason: 'consumer wellness vertical' },
    { term: 'dating', weight: 8, reason: 'consumer dating vertical' },
    { term: 'social', weight: 7, reason: 'consumer social vertical' },
    { term: 'gaming', weight: 8, reason: 'consumer gaming vertical' },
    { term: 'productivity', weight: 6, reason: 'consumer productivity' },
    { term: 'meditation', weight: 7, reason: 'consumer mental wellness' },
    { term: 'mental health', weight: 7, reason: 'consumer mental wellness' },
    { term: 'budgeting', weight: 7, reason: 'consumer finance' },
    { term: 'photo', weight: 6, reason: 'consumer creative tools' },
    { term: 'music', weight: 6, reason: 'consumer creative tools' },
    { term: 'video', weight: 6, reason: 'consumer creative tools' },
    // Consumer pricing signals
    { term: '$9.99', weight: 8, reason: 'consumer pricing' },
    { term: '$19/month', weight: 8, reason: 'consumer pricing' },
    { term: '$4.99', weight: 8, reason: 'consumer pricing' },
    { term: 'freemium', weight: 8, reason: 'consumer pricing model' },
    { term: 'in-app purchase', weight: 7, reason: 'IAP monetization' },
    { term: 'ads', weight: 6, reason: 'ad-supported monetization' },
    // Consumer user signals
    { term: 'people', weight: 5, reason: 'consumer audience' },
    { term: 'users', weight: 5, reason: 'consumer audience' },
    { term: 'individuals', weight: 6, reason: 'consumer audience' },
    { term: 'consumers', weight: 8, reason: 'consumer audience' },
    { term: 'helping people', weight: 6, reason: 'consumer framing' },
    { term: 'app for', weight: 6, reason: 'consumer app framing' },
    // Anti-indicators for consumer
    { term: 'enterprise', weight: -10, reason: 'enterprise (non-consumer) signal' },
    { term: 'fortune 500', weight: -10, reason: 'enterprise (non-consumer) signal' },
    { term: 'b2b', weight: -8, reason: 'business audience (non-consumer)' },
    { term: 'businesses', weight: -5, reason: 'business audience (non-consumer)' },
    { term: 'companies', weight: -5, reason: 'business audience (non-consumer)' },
    { term: 'teams', weight: -4, reason: 'business audience (non-consumer)' },
    { term: 'employees', weight: -4, reason: 'business audience (non-consumer)' },
    { term: 'workplace', weight: -6, reason: 'business context (non-consumer)' },
  ]);

  // Enterprise SaaS (enhanced enterprise signals)
  addHits(BusinessModelType.ENTERPRISE_SAAS, [
    // Strong enterprise signals
    { term: 'fortune 500', weight: 10, reason: 'Fortune 500 targeting' },
    { term: 'fortune 1000', weight: 10, reason: 'Fortune 1000 targeting' },
    { term: 'enterprise', weight: 8, reason: 'enterprise focus' },
    { term: 'custom implementation', weight: 8, reason: 'custom implementation services' },
    { term: 'custom implementations', weight: 8, reason: 'custom implementation services' },
    { term: 'ongoing support', weight: 7, reason: 'enterprise support' },
    { term: 'training services', weight: 7, reason: 'customer training services' },

    // Platform/software signals
    { term: 'ai platform', weight: 9, reason: 'AI platform positioning' },
    { term: 'platform', weight: 6, reason: 'platform model' },
    { term: 'solution', weight: 5, reason: 'solution language' },
    { term: 'software', weight: 6, reason: 'software product' },
    { term: 'saas', weight: 8, reason: 'SaaS delivery' },

    // Enterprise pricing signals
    { term: '$100k', weight: 9, reason: 'enterprise pricing' },
    { term: '$1m', weight: 9, reason: 'enterprise pricing' },
    { term: '$2m', weight: 9, reason: 'enterprise pricing' },
    { term: 'annually', weight: 5, reason: 'annual contracts' },

    // B2B signals
    { term: 'b2b', weight: 7, reason: 'B2B focus' },
    { term: 'companies', weight: 4, reason: 'company customers' },
    { term: 'businesses', weight: 4, reason: 'business customers' },
  ]);

  // Food service (high priority)
  addHits(BusinessModelType.FOOD_SERVICE, [
    { term: 'ghost kitchen', weight: 10, reason: 'ghost kitchen business model' },
    { term: 'cloud kitchen', weight: 10, reason: 'cloud kitchen operations' },
    { term: 'meal delivery', weight: 9, reason: 'meal delivery service' },
    { term: 'meal prep', weight: 8, reason: 'meal preparation service' },
    { term: 'food delivery', weight: 8, reason: 'food delivery business' },
    { term: 'commercial kitchen', weight: 9, reason: 'commercial kitchen operations' },
    { term: 'prepare meals', weight: 8, reason: 'meal preparation' },
    { term: 'doordash', weight: 7, reason: 'delivery platform distribution' },
    { term: 'uber eats', weight: 7, reason: 'delivery platform distribution' },
    { term: 'grubhub', weight: 7, reason: 'delivery platform distribution' },
    { term: 'restaurant', weight: 6, reason: 'restaurant operations' },
    { term: 'catering', weight: 7, reason: 'catering service' },
    { term: 'meal kit', weight: 8, reason: 'meal kit service' },
    { term: 'healthy meal', weight: 6, reason: 'meal service focus' },
    { term: 'nutrition', weight: 5, reason: 'nutrition focus' },
    { term: 'chef', weight: 5, reason: 'culinary operations' },
  ]);

  // DTC subscription
  const subscriptionIndicators = [
    { term: 'subscription box', weight: 8, reason: 'explicit subscription box model' },
    { term: 'monthly subscription', weight: 7, reason: 'recurring subscription model' },
    { term: 'subscribers pay', weight: 6, reason: 'subscription-based revenue' },
    { term: 'deliver', weight: 3, reason: 'delivery component' },
    { term: '/month', weight: 4, reason: 'monthly pricing' },
    { term: 'receive', weight: 2, reason: 'recurring delivery' },
    { term: 'coffee beans', weight: 3, reason: 'consumable product delivery' },
    { term: 'artisanal', weight: 2, reason: 'curated product selection' },
  ];
  addHits(BusinessModelType.DTC_SUBSCRIPTION, subscriptionIndicators);

  // Heavily penalize DTC subscription if Food Service context is strong
  if (scores[BusinessModelType.FOOD_SERVICE].score > 10 && scores[BusinessModelType.DTC_SUBSCRIPTION].score > 0) {
    scores[BusinessModelType.DTC_SUBSCRIPTION].score =
      scores[BusinessModelType.DTC_SUBSCRIPTION].score * 0.1;
    scores[BusinessModelType.DTC_SUBSCRIPTION].reasoning.push('subscription indicators discounted due to Food Service context');
  }

  // Physical product (penalize when subscription context is present)
  const subscriptionBonus = scores[BusinessModelType.DTC_SUBSCRIPTION].score > 0;
  const physicalWeightMultiplier = subscriptionBonus ? 0.3 : 1.0;
  if (strongPhysicalIntent) {
    // Seed a strong lead for PHYSICAL_PRODUCT so it wins ranking later
    scores[BusinessModelType.PHYSICAL_PRODUCT].score += 18;
    scores[BusinessModelType.PHYSICAL_PRODUCT].indicators.push('explicit-physical-intent');
    scores[BusinessModelType.PHYSICAL_PRODUCT].reasoning.push('explicit selling/making tangible goods with price/shipping signals');
  }
  const rawPhysicalIndicators: Array<{ term: string | RegExp; weight: number; reason: string; label?: string }> = [
    // Core artisan/manufacturing signals
    { term: /\bhand\s*-?made\b/i, weight: 6, reason: 'artisan manufacturing', label: 'handmade' },
    { term: /\bhand\s*-?crafted\b/i, weight: 5, reason: 'artisan manufacturing', label: 'handcrafted' },
    { term: /\bhand\s*-?stitched|hand\s*-?stitch(ed|ing)?\b/i, weight: 4, reason: 'artisan creation', label: 'hand-stitched' },
    { term: /\bcraft(s|ing)?\b/i, weight: 3, reason: 'artisan creation', label: 'craft' },
    { term: /\bmanufactur(ing|e)\b/i, weight: 4, reason: 'production process', label: 'manufacturing' },

    // Materials & category
    { term: /\bleather\b/i, weight: 6, reason: 'physical material production', label: 'leather' },
    { term: /\bleather\s+goods\b/i, weight: 6, reason: 'leather goods category', label: 'leather goods' },
    { term: /\b(bag|bags|handbag|handbags|purse|purses|tote|totes|wallet|wallets|belt|belts)\b/i, weight: 5, reason: 'physical product category', label: 'accessories' },
    { term: /\baccessor(y|ies)\b/i, weight: 3, reason: 'physical goods', label: 'accessories' },

    // Ecommerce & retail distribution hints
    { term: /\betsy\b/i, weight: 4, reason: 'ecommerce marketplace (Etsy)', label: 'etsy' },
    { term: /\bshopify\b/i, weight: 4, reason: 'DTC ecommerce platform', label: 'shopify' },
    { term: /\bonline store|storefront|webshop|e-?commerce\b/i, weight: 3, reason: 'online retail channel', label: 'online store' },
    { term: /\bretail|wholesale\b/i, weight: 3, reason: 'retail/wholesale channel', label: 'retail/wholesale' },
    { term: /\binventory|sku(s)?\b/i, weight: 3, reason: 'inventory-managed goods', label: 'inventory' },
    { term: /\bshipping|ship\b/i, weight: 3, reason: 'physical logistics', label: 'shipping' },

    // Pricing signals typical of goods
    { term: /\$\s?\d{2,4}(?:[-–]\$?\d{2,4})?/i, weight: 3, reason: 'priced physical goods', label: 'price mention' },
    { term: /\bunit\s*cost|cogs\b/i, weight: 3, reason: 'unit economics for goods', label: 'unit cost/COGS' },
  ];
  const scaledPhysical = rawPhysicalIndicators.map(ind => ({ ...ind, weight: ind.weight * physicalWeightMultiplier }));
  addHits(BusinessModelType.PHYSICAL_PRODUCT, scaledPhysical);

  // Marketplace
  addHits(BusinessModelType.MARKETPLACE, [
    { term: 'freelance', weight: 6, reason: 'freelancer platform' },
    { term: 'commission', weight: 5, reason: 'marketplace revenue model' },
    { term: 'bid', weight: 4, reason: 'bidding mechanism' },
    { term: 'platform', weight: 3, reason: 'platform business model' },
    { term: 'take %', weight: 5, reason: 'percentage-based revenue' },
  ]);

  // SaaS
  addHits(BusinessModelType.SAAS_B2B, [
    { term: 'software', weight: 6, reason: 'software product' },
    { term: 'saas', weight: 8, reason: 'explicit SaaS model' },
    { term: 'teams', weight: 4, reason: 'team-based usage' },
    { term: 'cloud-based', weight: 5, reason: 'cloud delivery' },
    { term: 'integration', weight: 3, reason: 'software integrations' },
  ]);

  // Extra enterprise trigger flags
  const isEnterprise = text.includes('fortune') || text.includes('enterprise') || /\$\d{2,3}k/.test(text) || /\$\d+m/.test(text);

  // Fintech
  addHits(BusinessModelType.FINTECH, [
    { term: 'fintech', weight: 10, reason: 'explicit fintech mention' },
    { term: 'credit score', weight: 9, reason: 'credit score focus' },
    { term: 'credit building', weight: 9, reason: 'credit building service' },
    { term: 'investment', weight: 7, reason: 'investment tools' },
    { term: 'micro-investment', weight: 8, reason: 'micro-investment feature' },
    { term: 'savings', weight: 5, reason: 'savings features' },
    { term: 'budgeting', weight: 5, reason: 'budgeting tools' },
    { term: 'bill payment', weight: 6, reason: 'bill payment tracking' },
    { term: 'debt', weight: 6, reason: 'debt management' },
    { term: 'payment', weight: 6, reason: 'payment processing' },
    { term: 'lending', weight: 7, reason: 'financial lending' },
    { term: 'banking', weight: 6, reason: 'banking services' },
    { term: 'financial', weight: 4, reason: 'financial services' },
  ]);

  // Healthcare
  addHits(BusinessModelType.HEALTHCARE, [
    { term: 'telemedicine', weight: 10, reason: 'explicit telemedicine platform' },
    { term: 'telehealth', weight: 10, reason: 'telehealth service' },
    { term: 'therapist', weight: 9, reason: 'mental health therapy' },
    { term: 'therapists', weight: 9, reason: 'mental health therapy' },
    { term: 'mental health', weight: 10, reason: 'mental health focus' },
    { term: 'counseling', weight: 8, reason: 'counseling services' },
    { term: 'therapy', weight: 7, reason: 'therapy services' },
    { term: 'hipaa', weight: 9, reason: 'HIPAA compliance requirement' },
    { term: 'patient', weight: 8, reason: 'patient-focused healthcare' },
    { term: 'patients', weight: 8, reason: 'patient-focused healthcare' },
    { term: 'medical', weight: 7, reason: 'medical services' },
    { term: 'clinical', weight: 7, reason: 'clinical services' },
    { term: 'doctor', weight: 7, reason: 'physician services' },
    { term: 'physician', weight: 7, reason: 'physician services' },
    { term: 'healthcare', weight: 8, reason: 'healthcare focus' },
    { term: 'health care', weight: 8, reason: 'healthcare focus' },
    { term: 'licensed therapist', weight: 10, reason: 'licensed healthcare provider' },
    { term: 'behavioral health', weight: 9, reason: 'behavioral health services' },
    { term: 'wellness', weight: 5, reason: 'wellness services' },
  ]);

  // Edtech
  addHits(BusinessModelType.EDTECH, [
    { term: 'learning', weight: 6, reason: 'educational focus' },
    { term: 'course', weight: 5, reason: 'course delivery' },
    { term: 'instructor', weight: 5, reason: 'instructor-based model' },
    { term: 'student', weight: 4, reason: 'student-focused' },
    { term: 'tutor', weight: 5, reason: 'tutoring services' },
    { term: 'tutoring', weight: 6, reason: 'tutoring services' },
    { term: 'certification', weight: 5, reason: 'professional certification/credentialing' },
    { term: 'curriculum', weight: 5, reason: 'curriculum development' },
    { term: /lms\b/i, weight: 6, reason: 'learning management system context', label: 'LMS' },
    { term: /scorm|xapi|lti/i, weight: 4, reason: 'learning standards/integrations', label: 'SCORM/XAPI/LTI' },
  ]);

  // Rank
  const ranked = Object.entries(scores)
    .map(([k, v]) => [k as BusinessModelType, v] as const)
    .filter(([, v]) => v.score > 0)
    .sort((a, b) => b[1].score - a[1].score);

  if (!ranked.length) {
    const primaryType = BusinessModelType.SERVICES;
    return {
      primaryType,
      confidence: 0.3,
      indicators: ['fallback classification'],
      constraints: constraintsForModel(primaryType),
      reasoningChain: ['No strong indicators found, defaulting to services'],
    };
  }

  let [winner, wData] = ranked[0];
  // Enterprise override: if enterprise signals present and ENTERPRISE_SAAS is competitive, prefer it
  if (isEnterprise && scores[BusinessModelType.ENTERPRISE_SAAS]) {
    const entScore = scores[BusinessModelType.ENTERPRISE_SAAS].score;
    const saasScore = scores[BusinessModelType.SAAS_B2B].score;
    if (winner === BusinessModelType.SAAS_B2B && (entScore >= 12 || entScore >= saasScore - 2)) {
      winner = BusinessModelType.ENTERPRISE_SAAS;
      wData = scores[BusinessModelType.ENTERPRISE_SAAS];
    }
  }
  const second = ranked[1];
  const confidence = Math.min(
    0.95,
    Math.max(
      0.4,
      (wData.score / 20) * (second ? wData.score / (wData.score + second[1].score) : 1)
    )
  );

  // Optional subtype detection for Healthcare
  let subType: string | undefined;
  if (winner === BusinessModelType.HEALTHCARE) {
    if (text.includes('mental health') || text.includes('therapist') || text.includes('counseling')) {
      subType = 'mental-health';
    } else if (text.includes('telemedicine') || text.includes('telehealth')) {
      subType = 'telehealth';
    } else if (text.includes('clinical') || text.includes('medical')) {
      subType = 'clinical-services';
    }
  } else if (winner === BusinessModelType.FOOD_SERVICE) {
    if (text.includes('ghost kitchen') || text.includes('cloud kitchen')) {
      subType = 'ghost-kitchen';
    } else if (text.includes('meal prep') || text.includes('subscription')) {
      subType = 'meal-prep-subscription';
    } else if (text.includes('catering') || text.includes('corporate')) {
      subType = 'corporate-catering';
    } else {
      subType = 'meal-delivery';
    }
  } else if (winner === BusinessModelType.MOBILE_APP) {
    if (text.includes('fitness') || text.includes('workout') || text.includes('nutrition')) {
      subType = 'fitness-wellness';
    } else if (text.includes('dating') || text.includes('relationship')) {
      subType = 'dating-social';
    } else if (text.includes('meditation') || text.includes('mental health') || text.includes('therapy')) {
      subType = 'mental-wellness';
    } else if (text.includes('budgeting') || text.includes('finance') || text.includes('money')) {
      subType = 'personal-finance';
    } else if (text.includes('productivity') || text.includes('task') || text.includes('todo')) {
      subType = 'productivity';
    } else if (text.includes('gaming') || text.includes('game')) {
      subType = 'gaming';
    } else {
      subType = 'general-consumer';
    }
  }

  return {
    primaryType: winner,
    subType,
    confidence,
    indicators: wData.indicators,
    constraints: constraintsForModel(winner),
    reasoningChain: wData.reasoning,
  };
}

export function classifyBusinessModel(ideaText: string): BusinessModelClassification {
  return detectBusinessModelWithPriority(ideaText);
}

export interface CategoryPivotOption {
  id: string;
  category: BusinessModelType;
  label: string;
  description: string;
  tam: string;
  growth: string;
  competition: string;
  majorCompetitors: string[];
  cacRange: string;
  ltv: string;
  barriers: string[];
  opportunities: string[];
  scoringFactors: {
    problem: number;
    underserved: number;
    demand: number;
    differentiation: number;
    economics: number;
    gtm: number;
  };
  relevantSkills: string[];
}

// Example catalogs (trimmed to essentials from user content)
export const PHYSICAL_PRODUCT_PIVOTS: CategoryPivotOption[] = [
  {
    id: 'physical.corporate-gifts',
    category: BusinessModelType.PHYSICAL_PRODUCT,
    label: 'Custom Corporate Gifts',
    description: 'Premium corporate gifting with personalization and bulk fulfillment',
    tam: '$22B (corporate gifts market)',
    growth: '8% CAGR, driven by remote work culture',
    competition: 'Moderate - fragmented suppliers',
    majorCompetitors: ['4imprint', 'Promotional Products Inc', 'Swag.com'],
    cacRange: '$300-$800',
    ltv: '$8,000-$25,000',
    barriers: ['Minimum order quantities', 'Seasonal demand', 'Corporate procurement cycles'],
    opportunities: ['Sustainable materials', 'Remote work gifts', 'Employee recognition'],
    scoringFactors: { problem: 60, underserved: 55, demand: 70, differentiation: 65, economics: 75, gtm: 60 },
    relevantSkills: ['craftsmanship', 'design', 'manufacturing', 'B2B sales']
  },
  {
    id: 'physical.sustainable-accessories',
    category: BusinessModelType.PHYSICAL_PRODUCT,
    label: 'Sustainable Fashion Accessories',
    description: 'Eco-certified materials with transparency and carbon-neutral shipping',
    tam: '$15B (sustainable fashion subset)',
    growth: '12% CAGR, consumer consciousness driving demand',
    competition: 'High but values-driven purchasing',
    majorCompetitors: ['Everlane', 'Patagonia Accessories', 'Stella McCartney'],
    cacRange: '$150-$400',
    ltv: '$3,000-$8,000',
    barriers: ['Certification costs', 'Supply chain transparency', 'Premium pricing'],
    opportunities: ['Gen Z consumers', 'Corporate sustainability', 'Circular economy'],
    scoringFactors: { problem: 55, underserved: 60, demand: 65, differentiation: 70, economics: 60, gtm: 65 },
    relevantSkills: ['sustainable sourcing', 'design', 'brand storytelling']
  }
];

export const MARKETPLACE_PIVOTS: CategoryPivotOption[] = [
  {
    id: 'marketplace.regulated-professional-services',
    category: BusinessModelType.MARKETPLACE,
    label: 'Regulated Professional Services',
    description: 'Legal, accounting, consulting with compliance and secure workflows',
    tam: '$15B (professional services software)',
    growth: '9% CAGR, compliance requirements increasing',
    competition: 'Moderate - regulatory moats',
    majorCompetitors: ['Clio', 'Thomson Reuters', 'Intuit ProConnect'],
    cacRange: '$800-$2,400',
    ltv: '$25,000-$60,000',
    barriers: ['Regulatory compliance', 'Professional licensing', 'Security requirements'],
    opportunities: ['Compliance automation', 'Client portals', 'Document security'],
    scoringFactors: { problem: 75, underserved: 70, demand: 65, differentiation: 80, economics: 85, gtm: 60 },
    relevantSkills: ['compliance knowledge', 'professional services', 'security']
  }
];

export const SAAS_PIVOTS: CategoryPivotOption[] = [
  {
    id: 'saas.healthcare-practice-mgmt',
    category: BusinessModelType.SAAS_B2B,
    label: 'Healthcare Practice Management',
    description: 'HIPAA-compliant workflow tools for medical practices',
    tam: '$8B (healthcare IT subset)',
    growth: '12% CAGR, digital health acceleration',
    competition: 'Moderate - specialty fragmentation',
    majorCompetitors: ['Epic', 'athenahealth', 'DrChrono'],
    cacRange: '$1,200-$3,600',
    ltv: '$35,000-$85,000',
    barriers: ['HIPAA compliance', 'Integration complexity', 'Long sales cycles'],
    opportunities: ['Specialty workflows', 'Telehealth integration', 'Patient engagement'],
    scoringFactors: { problem: 80, underserved: 70, demand: 75, differentiation: 65, economics: 85, gtm: 55 },
    relevantSkills: ['healthcare knowledge', 'compliance', 'workflow design']
  }
];

// Enterprise SaaS pivots (adapted from provided spec)
export const ENTERPRISE_SAAS_PIVOTS: CategoryPivotOption[] = [
  {
    id: 'healthcare-ai-clinical',
    category: BusinessModelType.ENTERPRISE_SAAS,
    label: 'Healthcare AI - Clinical Decision Support',
    description: 'AI-powered clinical documentation, diagnosis assistance, and care pathway optimization for hospital systems',
    tam: '$12B (healthcare AI & clinical decision support)',
    growth: '32% CAGR',
    competition: 'Medium (Epic, Cerner integrations required)',
    majorCompetitors: ['Notable Health', 'Nuance DAX', 'Abridge'],
    cacRange: '$20k-$150k',
    ltv: '$250k-$2M',
    barriers: [
      'HIPAA compliance and clinical validation required',
      'Long sales cycles (9-18 months)',
      'EHR integration complexity',
    ],
    opportunities: [
      'Regulatory moats through FDA clearances',
      'Sticky integrations with EHR systems',
      'High willingness to pay for clinical accuracy',
    ],
    // Map dimension improvements (~5-8 scale) to 0..100 scoring factors
    scoringFactors: { problem: 78, underserved: 62, demand: 75, differentiation: 55, economics: 60, gtm: 55 },
    relevantSkills: ['healthcare', 'compliance', 'enterprise sales']
  },
  {
    id: 'legal-ai-contract',
    category: BusinessModelType.ENTERPRISE_SAAS,
    label: 'Legal AI - Contract Intelligence & eDiscovery',
    description: 'AI contract review, clause extraction, risk analysis, and litigation support for law firms and corporate legal departments',
    tam: '$9B (legal tech AI subset)',
    growth: '28% CAGR',
    competition: 'Medium-High',
    majorCompetitors: ['Kira Systems', 'Luminance', 'eBrevia'],
    cacRange: '$15k-$80k',
    ltv: '$150k-$1M',
    barriers: [
      'Legal accuracy and liability concerns',
      'Bar association regulatory considerations',
      'Trust-building in conservative industry',
    ],
    opportunities: [
      'High-value workflows ($200-500/hr lawyer time)',
      'Recurring revenue from ongoing matters',
      'Network effects from clause libraries',
    ],
    scoringFactors: { problem: 72, underserved: 58, demand: 70, differentiation: 60, economics: 65, gtm: 50 },
    relevantSkills: ['legal domain', 'nlp', 'enterprise sales']
  },
  {
    id: 'finserv-compliance-fraud',
    category: BusinessModelType.ENTERPRISE_SAAS,
    label: 'Financial Services - Compliance & Fraud Detection',
    description: 'AI-powered AML, KYC, transaction monitoring, and fraud detection for banks, fintech, and payment processors',
    tam: '$15B (RegTech & fraud prevention)',
    growth: '25% CAGR',
    competition: 'High',
    majorCompetitors: ['ComplyAdvantage', 'Feedzai', 'Sift'],
    cacRange: '$25k-$120k',
    ltv: '$300k-$2M',
    barriers: [
      'Regulatory approval and audits required',
      'High accuracy requirements (false positives costly)',
      'Data security and privacy concerns',
    ],
    opportunities: [
      'Regulatory mandates create demand',
      'Mission-critical systems are sticky',
      'Expansion from compliance to broader FinCrime',
    ],
    scoringFactors: { problem: 80, underserved: 60, demand: 75, differentiation: 55, economics: 58, gtm: 45 },
    relevantSkills: ['compliance', 'ml ops', 'security']
  },
  {
    id: 'manufacturing-predictive',
    category: BusinessModelType.ENTERPRISE_SAAS,
    label: 'Manufacturing - Predictive Maintenance & QC',
    description: 'AI-powered predictive maintenance, quality control, and process optimization for industrial manufacturers',
    tam: '$8B (industrial AI subset)',
    growth: '30% CAGR',
    competition: 'Medium',
    majorCompetitors: ['Uptake', 'C3 AI', 'SparkCognition'],
    cacRange: '$10k-$90k',
    ltv: '$200k-$1.5M',
    barriers: [
      'OT/IoT integration complexity',
      'Long proof-of-concept cycles',
      'Industry-specific domain expertise required',
    ],
    opportunities: [
      'Clear ROI from downtime reduction',
      'Expansion across multiple plants',
      'Data moats from proprietary sensor data',
    ],
    scoringFactors: { problem: 70, underserved: 58, demand: 67, differentiation: 55, economics: 60, gtm: 55 },
    relevantSkills: ['industrial', 'iot', 'ml']
  },
];

export const EDTECH_PIVOTS: CategoryPivotOption[] = [
  {
    id: 'edtech.corporate-training-platform',
    category: BusinessModelType.EDTECH,
    label: 'Corporate Training Platform (B2B L&D)',
    description: 'Skills taxonomy, course authoring, assessments, and analytics for company upskilling (integrates with HRIS/LMS).',
    tam: '$22B (corporate learning tech)',
    growth: '10% CAGR — AI + compliance driving demand',
    competition: 'High — incumbents strong; niches open by role/industry',
    majorCompetitors: ['Docebo', 'Cornerstone', 'Workday Learning', 'Udemy Business'],
    cacRange: '$1,200–$5,000 (B2B midmarket)',
    ltv: '$30,000–$120,000',
    barriers: ['Proof of skill impact', 'Integrations (SSO/HRIS/LMS)', 'Change management'],
    opportunities: ['Role-based pathways', 'Manager dashboards', 'Built-in content marketplace'],
    scoringFactors: { problem: 78, underserved: 62, demand: 68, differentiation: 60, economics: 82, gtm: 58 },
    relevantSkills: ['B2B sales', 'LMS/LTI/SCORM', 'analytics']
  },
  {
    id: 'edtech.professional-certification-prep',
    category: BusinessModelType.EDTECH,
    label: 'Professional Certification Prep',
    description: 'High-stakes exam prep (cloud, cybersecurity, finance) with adaptive practice and cohort support.',
    tam: '$9B (professional exam prep)',
    growth: '8% CAGR — credentials inflation',
    competition: 'Moderate — fragmented by domain',
    majorCompetitors: ['A Cloud Guru', 'Whizlabs', 'Kaplan', 'Udacity (adjacent)'],
    cacRange: '$60–$250',
    ltv: '$300–$1,200',
    barriers: ['Content freshness', 'Exam alignment', 'Instructor quality'],
    opportunities: ['Official partnerships', 'Job placement tie-ins', 'Adaptive learning'],
    scoringFactors: { problem: 72, underserved: 65, demand: 74, differentiation: 62, economics: 66, gtm: 64 },
    relevantSkills: ['instructional design', 'domain expertise', 'community']
  },
  {
    id: 'edtech.tutoring-platform',
    category: BusinessModelType.EDTECH,
    label: 'Tutoring Platform (K‑12/College)',
    description: 'On-demand and scheduled tutoring with quality controls, curriculum alignment, and school district pilots.',
    tam: '$8B (online tutoring)',
    growth: '12% CAGR — post-remote learning gaps',
    competition: 'High — marketplaces and agencies',
    majorCompetitors: ['Varsity Tutors', 'Wyzant', 'Tutor.com'],
    cacRange: '$40–$150 (parent/student)',
    ltv: '$400–$1,800',
    barriers: ['Tutor quality/reliability', 'District procurement', 'Safety/compliance'],
    opportunities: ['School contracts', 'Data-driven matching', 'Foundational skills focus'],
    scoringFactors: { problem: 68, underserved: 62, demand: 70, differentiation: 58, economics: 60, gtm: 62 },
    relevantSkills: ['marketplace ops', 'trust & safety', 'school sales']
  },
  {
    id: 'edtech.cohort-based-exec-education',
    category: BusinessModelType.EDTECH,
    label: 'Cohort-Based Executive Education',
    description: 'Short, outcomes-focused cohorts for managers and ICs; capstone projects, mentors, and alumni network.',
    tam: '$6B (exec/manager education online)',
    growth: '9% CAGR',
    competition: 'Moderate — brand matters, niches open',
    majorCompetitors: ['Section', 'Reforge', 'AltMBA'],
    cacRange: '$200–$800',
    ltv: '$1,200–$6,000',
    barriers: ['Instructor supply', 'Outcomes proof', 'Community moderation'],
    opportunities: ['Company sponsorships', 'Career ladders', 'Mentor marketplace'],
    scoringFactors: { problem: 66, underserved: 60, demand: 64, differentiation: 65, economics: 72, gtm: 60 },
    relevantSkills: ['program design', 'community', 'partnerships']
  },
  {
    id: 'edtech.vocational-upskilling-microlearning',
    category: BusinessModelType.EDTECH,
    label: 'Vocational Upskilling (Microlearning)',
    description: 'Short modules for frontline roles (retail, hospitality, logistics) with mobile-first delivery and certifications.',
    tam: '$5B (vocational digital training)',
    growth: '11% CAGR',
    competition: 'Low–Moderate — underserved verticals',
    majorCompetitors: ['Axonify', 'EduMe', 'EdApp'],
    cacRange: '$800–$3,000 (B2B)',
    ltv: '$20,000–$80,000',
    barriers: ['Manager adoption', 'Content localization', 'Device constraints'],
    opportunities: ['OSHA/compliance bundles', 'Talent pipelines', 'Incentives/points'],
    scoringFactors: { problem: 74, underserved: 70, demand: 66, differentiation: 64, economics: 78, gtm: 56 },
    relevantSkills: ['mobile UX', 'operations', 'B2B2C']
  }
];

export const MOBILE_APP_PIVOTS: CategoryPivotOption[] = [
  {
    id: 'mobile.habit-tracker',
    category: BusinessModelType.MOBILE_APP,
    label: 'Habit Tracker (Wellness)',
    description: 'Lightweight habit & mood tracker with streaks, social accountability, and coach marketplaces',
    tam: '$6B (wellness apps; large addressable audience)',
    growth: '9% CAGR',
    competition: 'High - differentiation via niche and UX',
    majorCompetitors: ['Fabulous', 'Habitica', 'Streaks'],
    cacRange: '$1-$5 (organic/UGC) · $2-$15 (paid)',
    ltv: '$10-$60 (IAP/subscription)',
    barriers: ['retention curve', 'paid UA costs', 'feature parity'],
    opportunities: ['community challenges', 'coach add-ons', 'B2B perks'],
    scoringFactors: { problem: 55, underserved: 58, demand: 62, differentiation: 55, economics: 52, gtm: 65 },
    relevantSkills: ['mobile UX', 'growth loops', 'content/community']
  },
  {
    id: 'mobile.corporate-wellness-b2b2c',
    category: BusinessModelType.MOBILE_APP,
    label: 'Corporate Wellness Programs (B2B2C)',
    description: 'Sell fitness/wellness platform to HR departments as employee benefit. Companies pay $5-15 per employee/month',
    tam: '$8B (corporate wellness market)',
    growth: '7% CAGR',
    competition: 'Medium',
    majorCompetitors: ['Wellable', 'Virgin Pulse', 'Gympass'],
    cacRange: '$1,000-$5,000 (B2B)',
    ltv: '$50,000-$200,000',
    barriers: ['Long B2B sales cycles (3-9 months)', 'HR integration requirements', 'Engagement metrics critical for renewals'],
    opportunities: ['Predictable B2B revenue vs consumer churn', 'Built-in distribution through employers', 'Sticky contracts (annual renewals)'],
    scoringFactors: { problem: 65, underserved: 60, demand: 66, differentiation: 58, economics: 70, gtm: 60 },
    relevantSkills: ['B2B sales', 'fitness', 'employee benefits']
  },
  {
    id: 'mobile.physical-therapy-rehab',
    category: BusinessModelType.MOBILE_APP,
    label: 'Physical Therapy & Rehabilitation Apps',
    description: 'Clinical-grade PT exercises, recovery tracking, and provider integration. Insurance reimbursement + patient co-pay',
    tam: '$6B (digital therapeutics for MSK)',
    growth: '25% CAGR',
    competition: 'Medium',
    majorCompetitors: ['Hinge Health', 'Sword Health', 'Kaia Health'],
    cacRange: '$50-$300 (provider/patient mix)',
    ltv: '$500-$3,000',
    barriers: ['Clinical validation studies required', 'Insurance reimbursement complexity', 'Provider adoption needed'],
    opportunities: ['Insurance reimbursement reduces CAC', 'Medical necessity creates urgency', 'Regulatory moats (FDA clearance)'],
    scoringFactors: { problem: 70, underserved: 60, demand: 72, differentiation: 60, economics: 62, gtm: 55 },
    relevantSkills: ['healthcare', 'regulatory', 'clinical partnerships']
  },
  {
    id: 'mobile.senior-fitness-fall-prevention',
    category: BusinessModelType.MOBILE_APP,
    label: 'Senior Fitness & Fall Prevention',
    description: 'Age-appropriate exercise programs, balance training, and caregiver monitoring for 65+ demographic',
    tam: '$6B (senior fitness & preventive health)',
    growth: '15% CAGR',
    competition: 'Low-Medium',
    majorCompetitors: ['Bold', 'Nymbl', 'SilverSneakers (offline)'],
    cacRange: '$20-$120',
    ltv: '$200-$1,200',
    barriers: ['UI/UX complexity for older users', 'Distribution to senior population', 'Trust-building with caregivers'],
    opportunities: ['Medicare Advantage partnerships', 'Lower competition than general fitness', 'Caregiver willingness to pay'],
    scoringFactors: { problem: 65, underserved: 60, demand: 65, differentiation: 56, economics: 58, gtm: 55 },
    relevantSkills: ['senior UX', 'health partnerships', 'distribution']
  },
  {
    id: 'mobile.youth-sports-training',
    category: BusinessModelType.MOBILE_APP,
    label: 'Youth Sports Training & Coaching',
    description: 'Sport-specific training programs, video analysis, and parent-coach communication for competitive youth athletes',
    tam: '$4B (youth sports tech)',
    growth: '12% CAGR',
    competition: 'Low-Medium',
    majorCompetitors: ['CoachNow', 'Hudl Technique', 'HomeCourt'],
    cacRange: '$10-$60',
    ltv: '$150-$900',
    barriers: ['Sport-specific expertise required', 'Parent as payer, child as user', 'Seasonal usage patterns'],
    opportunities: ['Parents highly motivated for child success', 'Premium pricing ($30-50/month)', 'Team/club bulk licensing'],
    scoringFactors: { problem: 60, underserved: 58, demand: 63, differentiation: 55, economics: 55, gtm: 55 },
    relevantSkills: ['sports domain', 'video analysis', 'youth markets']
  },
  {
    id: 'mobile.prenatal-postpartum-fitness',
    category: BusinessModelType.MOBILE_APP,
    label: 'Prenatal & Postpartum Fitness',
    description: 'Pregnancy-safe workouts, pelvic floor exercises, and postpartum recovery tracking with medical guidance',
    tam: '$3B (maternal health tech)',
    growth: '20% CAGR',
    competition: 'Medium',
    majorCompetitors: ['Expectful', 'Pvolve', 'Kegg'],
    cacRange: '$15-$80',
    ltv: '$120-$600',
    barriers: ['Medical liability concerns', 'Clinical content validation needed', 'Short window of high engagement'],
    opportunities: ['High willingness to pay during pregnancy', 'Provider referral potential', 'OB/GYN partnerships'],
    scoringFactors: { problem: 68, underserved: 58, demand: 62, differentiation: 55, economics: 50, gtm: 55 },
    relevantSkills: ['women health', 'content validation', 'provider partnerships']
  },
  {
    id: 'mobile.offline-field-data',
    category: BusinessModelType.MOBILE_APP,
    label: 'Offline Field Data Capture',
    description: 'Offline-first forms, photos, and GPS for inspections and field audits with sync and templates',
    tam: '$3B (field service apps)',
    growth: '8% CAGR',
    competition: 'Moderate - opportunity in specialization',
    majorCompetitors: ['Fulcrum', 'iAuditor', 'ProntoForms'],
    cacRange: '$10-$60 (B2B self-serve)',
    ltv: '$150-$900 (SMB seats)',
    barriers: ['device fragmentation', 'sync conflicts', 'enterprise pilots'],
    opportunities: ['vertical templates', 'workflow integrations', 'audit trail'],
    scoringFactors: { problem: 70, underserved: 62, demand: 64, differentiation: 60, economics: 62, gtm: 58 },
    relevantSkills: ['offline sync', 'B2B sales', 'workflow design']
  },
  {
    id: 'mobile.creator-video-tools',
    category: BusinessModelType.MOBILE_APP,
    label: 'Creator Video Tools (Lite)',
    description: 'Mobile-first editing with captioning, templates, and viral hooks aimed at short-form creators',
    tam: '$5B (creator economy tooling)',
    growth: '12% CAGR',
    competition: 'High - but niche workflows can win',
    majorCompetitors: ['CapCut', 'InShot', 'VN'],
    cacRange: '$0-$5 (organic TikTok/UGC)',
    ltv: '$15-$80 (IAP/subscription)',
    barriers: ['performance on low-end devices', 'format churn'],
    opportunities: ['template marketplaces', 'collabs', 'brand kits'],
    scoringFactors: { problem: 58, underserved: 60, demand: 70, differentiation: 58, economics: 55, gtm: 68 },
    relevantSkills: ['video processing', 'UGC growth', 'design systems']
  }
];

export const FINTECH_PIVOTS: CategoryPivotOption[] = [
  {
    id: 'fintech.employee-financial-wellness',
    category: BusinessModelType.FINTECH,
    label: 'B2B Employee Financial Wellness',
    description: 'Corporate benefits platform for employee financial health and education',
    tam: '$8B (workplace financial wellness)',
    growth: '18% CAGR, employer benefits expansion',
    competition: 'Moderate - enterprise sales required',
    majorCompetitors: ['Brightside', 'LearnLux', 'Best Money Moves', 'SmartDollar'],
    cacRange: '$3,000-$10,000',
    ltv: '$60,000-$180,000',
    barriers: ['Enterprise sales cycles', 'Benefits integration', 'Regulatory compliance'],
    opportunities: ['HR tech partnerships', 'Student loan benefits', 'Financial stress reduction'],
    scoringFactors: { problem: 75, underserved: 70, demand: 80, differentiation: 65, economics: 85, gtm: 60 },
    relevantSkills: ['B2B sales', 'HR tech', 'financial planning', 'benefits administration']
  },
  {
    id: 'fintech.smb-credit-building',
    category: BusinessModelType.FINTECH,
    label: 'SMB Business Credit Building',
    description: 'Business credit monitoring and building tools for small businesses',
    tam: '$12B (small business financial tools)',
    growth: '14% CAGR, SMB digitization trend',
    competition: 'Moderate - established players but room for innovation',
    majorCompetitors: ['Nav', 'CreditStrong Business', 'Dun & Bradstreet'],
    cacRange: '$400-$1,200',
    ltv: '$8,000-$25,000',
    barriers: ['Business data access', 'Commercial credit bureaus', 'Fraud prevention'],
    opportunities: ['Lending marketplace integration', 'Invoice factoring', 'Business formation'],
    scoringFactors: { problem: 70, underserved: 65, demand: 75, differentiation: 70, economics: 75, gtm: 65 },
    relevantSkills: ['business finance', 'B2B sales', 'credit reporting', 'small business']
  },
  {
    id: 'fintech.gig-worker-tools',
    category: BusinessModelType.FINTECH,
    label: 'Gig Worker Financial Tools',
    description: 'Income smoothing, tax planning, and benefits for freelancers and contractors',
    tam: '$6B (gig economy financial services)',
    growth: '22% CAGR, gig economy expansion',
    competition: 'Moderate - growing market with opportunities',
    majorCompetitors: ['Keeper Tax', 'Catch', 'Hurdlr', 'QuickBooks Self-Employed'],
    cacRange: '$200-$600',
    ltv: '$3,000-$9,000',
    barriers: ['Income verification', 'Tax complexity', 'Seasonal usage patterns'],
    opportunities: ['Platform partnerships (Uber, DoorDash)', 'Income-based lending', 'Insurance products'],
    scoringFactors: { problem: 75, underserved: 70, demand: 80, differentiation: 65, economics: 70, gtm: 70 },
    relevantSkills: ['tax knowledge', 'gig economy', 'platform integrations', 'consumer finance']
  },
  {
    id: 'fintech.student-financial-literacy',
    category: BusinessModelType.FINTECH,
    label: 'Student Financial Literacy Platform',
    description: 'Campus-focused financial education with budgeting and credit building tools',
    tam: '$4B (student financial services)',
    growth: '16% CAGR, student debt crisis awareness',
    competition: 'Low - underserved demographic',
    majorCompetitors: ['Mos', 'Greenlight (younger demo)', 'Credit Karma (broader)'],
    cacRange: '$100-$300',
    ltv: '$2,000-$6,000',
    barriers: ['Limited student income', 'Campus partnerships', 'Parent involvement'],
    opportunities: ['University partnerships', 'Student loan refinancing', 'First credit card'],
    scoringFactors: { problem: 70, underserved: 75, demand: 70, differentiation: 70, economics: 60, gtm: 65 },
    relevantSkills: ['education market', 'financial literacy', 'campus partnerships', 'youth engagement']
  },
  {
    id: 'fintech.debt-optimization',
    category: BusinessModelType.FINTECH,
    label: 'AI-Powered Debt Optimization',
    description: 'Automated debt payoff strategies with refinancing recommendations',
    tam: '$5B (debt management software)',
    growth: '12% CAGR, consumer debt levels high',
    competition: 'Moderate - established debt management companies',
    majorCompetitors: ['Tally', 'Payoff', 'SoFi', 'Marcus by Goldman Sachs'],
    cacRange: '$150-$400',
    ltv: '$2,500-$8,000',
    barriers: ['Credit access requirements', 'Debt consolidation regulations', 'Trust building'],
    opportunities: ['Refinancing partnerships', 'Credit counseling integration', 'Financial coaching'],
    scoringFactors: { problem: 80, underserved: 60, demand: 75, differentiation: 65, economics: 70, gtm: 60 },
    relevantSkills: ['debt management', 'credit analysis', 'financial planning', 'lending partnerships']
  },
  {
    id: 'fintech.immigrant-financial-services',
    category: BusinessModelType.FINTECH,
    label: 'Immigrant Financial Services',
    description: 'Credit building and banking for immigrants with limited US credit history',
    tam: '$7B (immigrant financial services)',
    growth: '15% CAGR, underserved demographic',
    competition: 'Low - highly underserved market',
    majorCompetitors: ['Nova Credit', 'Petal', 'Mission Lane', 'Self'],
    cacRange: '$300-$800',
    ltv: '$5,000-$15,000',
    barriers: ['Alternative credit data', 'Regulatory compliance', 'Language barriers'],
    opportunities: ['Remittance integration', 'International credit history', 'Community partnerships'],
    scoringFactors: { problem: 85, underserved: 80, demand: 75, differentiation: 80, economics: 70, gtm: 65 },
    relevantSkills: ['alternative credit scoring', 'multilingual support', 'compliance']
  },
  {
    id: 'fintech.savings-automation',
    category: BusinessModelType.FINTECH,
    label: 'Gamified Savings & Investment',
    description: 'Behavioral finance app with automated savings rules and micro-investing',
    tam: '$9B (consumer savings apps)',
    growth: '20% CAGR, financial wellness trend',
    competition: 'High but differentiation through features',
    majorCompetitors: ['Acorns', 'Chime', 'Digit', 'Qapital'],
    cacRange: '$80-$250',
    ltv: '$1,500-$4,000',
    barriers: ['Banking partnerships', 'Investment regulations', 'Low margins'],
    opportunities: ['Behavioral psychology features', 'Social savings challenges', 'Crypto integration'],
    scoringFactors: { problem: 60, underserved: 55, demand: 75, differentiation: 65, economics: 60, gtm: 70 },
    relevantSkills: ['behavioral finance', 'gamification', 'investment products', 'banking APIs']
  }
];

export const HEALTHCARE_PIVOTS: CategoryPivotOption[] = [
  {
    id: 'health.corporate-mental-health-benefits',
    label: 'Corporate Mental Health Benefits (EAP)',
    description: 'B2B employee assistance programs with therapy, coaching, and wellness',
    category: BusinessModelType.HEALTHCARE,
    tam: '$14B (corporate mental health benefits)',
    growth: '22% CAGR, workplace mental health priority',
    competition: 'Moderate - enterprise sales complexity',
    majorCompetitors: ['Lyra Health', 'Spring Health', 'Modern Health', 'Ginger'],
    cacRange: '$5,000-$15,000',
    ltv: '$100,000-$300,000',
    barriers: ['Enterprise sales cycles', 'HIPAA compliance', 'Benefits integration', 'Utilization tracking'],
    opportunities: ['Hybrid work mental health', 'Manager training', 'Crisis intervention', 'Preventive care'],
    scoringFactors: { problem: 80, underserved: 70, demand: 85, differentiation: 70, economics: 85, gtm: 60 },
    relevantSkills: ['B2B healthcare sales', 'HR partnerships', 'clinical operations', 'benefits administration']
  },
  {
    id: 'health.specialty-telemedicine',
    label: 'Specialty Telemedicine (Derm, Nutrition, Chronic Care)',
    description: 'Virtual care for specific medical specialties with outcome tracking',
    category: BusinessModelType.HEALTHCARE,
    tam: '$18B (specialty telehealth)',
    growth: '19% CAGR, post-pandemic virtual care adoption',
    competition: 'Moderate - specialty expertise required',
    majorCompetitors: ['Teladoc', 'MDLive', 'Doctor on Demand', 'Hims & Hers'],
    cacRange: '$300-$900',
    ltv: '$2,500-$8,000',
    barriers: ['Provider credentialing', 'State licensing requirements', 'Insurance contracting', 'Clinical protocols'],
    opportunities: ['Chronic disease management', 'Preventive care', 'Second opinions', 'Rural access'],
    scoringFactors: { problem: 75, underserved: 65, demand: 80, differentiation: 70, economics: 75, gtm: 65 },
    relevantSkills: ['clinical operations', 'provider recruitment', 'telehealth compliance', 'specialty expertise']
  },
  {
    id: 'health.physical-therapy-telehealth',
    label: 'Physical Therapy & Wellness Coaching',
    description: 'Remote PT, pain management, and musculoskeletal care with video guidance',
    category: BusinessModelType.HEALTHCARE,
    tam: '$8B (virtual PT and MSK care)',
    growth: '17% CAGR, value-based care expansion',
    competition: 'Low - emerging category',
    majorCompetitors: ['Hinge Health', 'Sword Health', 'Omada Health', 'Kaia Health'],
    cacRange: '$200-$600',
    ltv: '$1,800-$5,000',
    barriers: ['Exercise prescription liability', 'Outcome measurement', 'Insurance reimbursement', 'Adherence tracking'],
    opportunities: ['Post-surgical recovery', 'Chronic pain management', 'Injury prevention', 'Elderly care'],
    scoringFactors: { problem: 80, underserved: 75, demand: 75, differentiation: 75, economics: 70, gtm: 70 },
    relevantSkills: ['PT expertise', 'MSK care', 'outcome tracking', 'wellness coaching']
  },
  {
    id: 'health.senior-care-coordination',
    label: 'Senior Care Coordination & Telemedicine',
    description: 'Virtual care and care coordination for aging populations and caregivers',
    category: BusinessModelType.HEALTHCARE,
    tam: '$12B (senior care technology)',
    growth: '15% CAGR, aging population growth',
    competition: 'Moderate - fragmented market',
    majorCompetitors: ['CareLinx', 'Honor', 'Papa', 'DispatchHealth'],
    cacRange: '$400-$1,200',
    ltv: '$8,000-$20,000',
    barriers: ['Technology adoption with elderly', 'Caregiver coordination', 'Medicare reimbursement', 'Multi-stakeholder sales'],
    opportunities: ['Chronic condition management', 'Medication adherence', 'Fall prevention', 'Social isolation'],
    scoringFactors: { problem: 85, underserved: 80, demand: 75, differentiation: 75, economics: 70, gtm: 60 },
    relevantSkills: ['geriatric care', 'caregiver support', 'care coordination', 'Medicare knowledge']
  },
  {
    id: 'health.pediatric-teletherapy',
    label: 'Pediatric Teletherapy & Developmental Services',
    description: 'Virtual speech, occupational, and behavioral therapy for children',
    category: BusinessModelType.HEALTHCARE,
    tam: '$6B (pediatric therapy services)',
    growth: '20% CAGR, early intervention demand',
    competition: 'Low - highly underserved',
    majorCompetitors: ['Little Otter', 'Brightline', 'Hazel Health', 'AbleTo Kids'],
    cacRange: '$250-$700',
    ltv: '$4,000-$12,000',
    barriers: ['Parent engagement', 'School partnerships', 'Pediatric specialist shortage', 'Insurance credentialing'],
    opportunities: ['School-based services', 'Autism support', 'ADHD management', 'Learning disabilities'],
    scoringFactors: { problem: 85, underserved: 80, demand: 80, differentiation: 80, economics: 65, gtm: 65 },
    relevantSkills: ['pediatric therapy', 'developmental psychology', 'school partnerships', 'parent communication']
  },
  {
    id: 'health.womens-health-telehealth',
    label: "Women's Health Telehealth",
    description: 'Virtual care for reproductive health, prenatal care, and menopause management',
    category: BusinessModelType.HEALTHCARE,
    tam: '$10B (women\'s health digital)',
    growth: '18% CAGR, reproductive health access focus',
    competition: 'Moderate - privacy and trust critical',
    majorCompetitors: ['Maven Clinic', 'Tia', 'Nurx', 'Ro for Women'],
    cacRange: '$150-$500',
    ltv: '$2,000-$6,000',
    barriers: ['State regulations', 'Prescription policies', 'Sensitive content', 'Insurance coverage gaps'],
    opportunities: ['Fertility care', 'Pregnancy support', 'Postpartum care', 'Menopause management'],
    scoringFactors: { problem: 75, underserved: 70, demand: 80, differentiation: 70, economics: 70, gtm: 70 },
    relevantSkills: ["women's health expertise", 'OB/GYN partnerships', 'reproductive health policy', 'patient education']
  },
  {
    id: 'health.behavioral-health-substance-abuse',
    label: 'Substance Abuse & Addiction Treatment',
    description: 'Virtual addiction treatment, recovery coaching, and peer support',
    category: BusinessModelType.HEALTHCARE,
    tam: '$9B (digital addiction treatment)',
    growth: '16% CAGR, opioid crisis response',
    competition: 'Moderate - clinical protocols required',
    majorCompetitors: ['Workit Health', 'Ophelia', 'Boulder Care', 'Monument'],
    cacRange: '$300-$900',
    ltv: '$5,000-$15,000',
    barriers: ['Crisis intervention protocols', 'Medication management', 'Recovery support', 'Stigma reduction'],
    opportunities: ['Medication-assisted treatment', 'Family support', 'Employer partnerships', 'Justice system integration'],
    scoringFactors: { problem: 90, underserved: 85, demand: 75, differentiation: 80, economics: 70, gtm: 55 },
    relevantSkills: ['addiction medicine', 'behavioral health', 'crisis management', 'recovery support']
  }
];

// Food Service pivots
export const FOOD_SERVICE_PIVOTS: CategoryPivotOption[] = [
  {
    id: 'corporate-meal-programs',
    label: 'Corporate Meal Programs (B2B Catering)',
    description: 'Office meal delivery and corporate catering with recurring contracts',
    category: BusinessModelType.FOOD_SERVICE,
    tam: '$18B (corporate food service)',
    growth: '14% CAGR, hybrid work driving meal benefits',
    competition: 'Moderate - relationship-based sales',
    majorCompetitors: ['ezCater', 'Fooda', 'ZeroCater', 'Crafty'],
    cacRange: '$2,000-$6,000',
    ltv: '$50,000-$150,000',
    barriers: ['Enterprise sales cycles', 'Consistent quality at scale', 'Logistics complexity'],
    opportunities: ['Hybrid work meal budgets', 'Employee retention', 'Dietary accommodations'],
    scoringFactors: { problem: 70, underserved: 60, demand: 75, differentiation: 65, economics: 80, gtm: 60 },
    relevantSkills: ['B2B sales', 'food operations', 'logistics', 'account management']
  },
  {
    id: 'meal-prep-subscription',
    label: 'Meal Prep Subscription Service',
    description: 'Weekly prepared meal boxes with macro tracking and dietary customization',
    category: BusinessModelType.FOOD_SERVICE,
    tam: '$10B (meal kit and prep market)',
    growth: '16% CAGR, health consciousness growing',
    competition: 'High but niche opportunities',
    majorCompetitors: ['Factor', 'Trifecta', 'Territory Foods', 'Freshly'],
    cacRange: '$80-$200',
    ltv: '$1,500-$4,000',
    barriers: ['Food safety regulations', 'Churn management', 'Cold chain logistics'],
    opportunities: ['Fitness community partnerships', 'Medical nutrition therapy', 'Performance nutrition'],
    scoringFactors: { problem: 65, underserved: 55, demand: 70, differentiation: 60, economics: 65, gtm: 65 },
    relevantSkills: ['nutrition knowledge', 'food prep operations', 'subscription management', 'logistics']
  },
  {
    id: 'virtual-restaurant-brands',
    label: 'Virtual Restaurant Brand Network',
    description: 'Multiple digital-only restaurant concepts from one kitchen with platform optimization',
    category: BusinessModelType.FOOD_SERVICE,
    tam: '$8B (ghost kitchen market)',
    growth: '20% CAGR, delivery platform growth',
    competition: 'Moderate - operational excellence required',
    majorCompetitors: ['Virtual Dining Concepts', 'Nextbite', 'C3', 'Kitchen United'],
    cacRange: '$50-$150',
    ltv: '$800-$2,500',
    barriers: ['Brand dilution risk', 'Platform commission costs', 'Kitchen efficiency'],
    opportunities: ['Platform algorithm optimization', 'Daypart optimization', 'Celebrity partnerships'],
    scoringFactors: { problem: 60, underserved: 60, demand: 70, differentiation: 65, economics: 60, gtm: 70 },
    relevantSkills: ['restaurant operations', 'brand development', 'platform marketing', 'kitchen efficiency']
  },
  {
    id: 'dietary-specialty-meals',
    label: 'Dietary Specialty Meal Delivery',
    description: 'Medical-grade meals for specific diets: diabetic, renal, allergen-free, autoimmune',
    category: BusinessModelType.FOOD_SERVICE,
    tam: '$6B (specialty diet food)',
    growth: '18% CAGR, chronic disease management',
    competition: 'Low - medical expertise required',
    majorCompetitors: ['Magic Kitchen', "Mom's Meals", 'BistroMD', 'Diet-to-Go'],
    cacRange: '$150-$400',
    ltv: '$3,000-$8,000',
    barriers: ['Nutritionist partnerships', 'Medical claims regulations', 'Insurance reimbursement'],
    opportunities: ['Diabetes management', 'Kidney disease', 'Food allergies', 'Autoimmune protocols'],
    scoringFactors: { problem: 80, underserved: 75, demand: 70, differentiation: 80, economics: 70, gtm: 60 },
    relevantSkills: ['clinical nutrition', 'medical partnerships', 'food safety', 'dietary compliance']
  },
  {
    id: 'senior-meal-delivery',
    label: 'Senior Nutrition & Meal Delivery',
    description: 'Age-appropriate meals with nutrition tracking and caregiver coordination',
    category: BusinessModelType.FOOD_SERVICE,
    tam: '$9B (senior meal services)',
    growth: '12% CAGR, aging population',
    competition: 'Moderate - Medicaid/Medicare opportunities',
    majorCompetitors: ["Mom's Meals", 'Silver Cuisine', 'Meals on Wheels', 'Magic Kitchen'],
    cacRange: '$200-$500',
    ltv: '$5,000-$15,000',
    barriers: ['Medicare/Medicaid navigation', 'Soft diet requirements', 'Delivery coordination'],
    opportunities: ['Medicare Advantage partnerships', 'Chronic disease management', 'Hospital discharge'],
    scoringFactors: { problem: 85, underserved: 80, demand: 75, differentiation: 75, economics: 75, gtm: 60 },
    relevantSkills: ['geriatric nutrition', 'Medicare knowledge', 'caregiver communication', 'care coordination']
  },
  {
    id: 'athlete-performance-nutrition',
    label: 'Athlete Performance Nutrition',
    description: 'Sports nutrition meal plans with macro optimization and timing protocols',
    category: BusinessModelType.FOOD_SERVICE,
    tam: '$4B (sports nutrition meals)',
    growth: '15% CAGR, sports performance focus',
    competition: 'Moderate - specialized knowledge required',
    majorCompetitors: ['Trifecta', 'Icon Meals', 'Performance Kitchen', 'Eat Clean Bro'],
    cacRange: '$100-$300',
    ltv: '$2,000-$6,000',
    barriers: ['Sports nutrition expertise', 'Athlete partnerships', 'Seasonal demand'],
    opportunities: ['College athletics', 'Professional teams', 'CrossFit gyms', 'Bodybuilding'],
    scoringFactors: { problem: 70, underserved: 70, demand: 65, differentiation: 75, economics: 65, gtm: 70 },
    relevantSkills: ['sports nutrition', 'athlete relationships', 'performance tracking', 'gym partnerships']
  },
  {
    id: 'family-meal-solution',
    label: 'Family Meal Solutions',
    description: 'Kid-friendly, family-sized meals with nutritional education and variety',
    category: BusinessModelType.FOOD_SERVICE,
    tam: '$12B (family meal delivery)',
    growth: '13% CAGR, dual-income families',
    competition: 'High but segmentation opportunities',
    majorCompetitors: ['HelloFresh Family', 'Home Chef', 'Blue Apron', 'EveryPlate'],
    cacRange: '$80-$200',
    ltv: '$1,200-$3,500',
    barriers: ['Kid taste preferences', 'Price sensitivity', 'Subscription fatigue'],
    opportunities: ['Picky eater solutions', 'Nutrition education', 'School partnerships'],
    scoringFactors: { problem: 65, underserved: 60, demand: 75, differentiation: 60, economics: 60, gtm: 70 },
    relevantSkills: ['family nutrition', 'child development', 'parent marketing', 'meal planning']
  }
];

export const DTC_SUBSCRIPTION_PIVOTS: CategoryPivotOption[] = [
  {
    id: 'dtc.coffee-subscription',
    category: BusinessModelType.DTC_SUBSCRIPTION,
    label: 'Curated Coffee Subscription',
    description: 'Tiered monthly coffee boxes with taste quiz onboarding and sampler-first approach',
    tam: '$38B (global coffee market; subscription subset growing rapidly)',
    growth: '10% CAGR for subscription coffee',
    competition: 'Moderate - strong DTC brands but room for niche curation',
    majorCompetitors: ['Trade Coffee', 'Blue Bottle', 'Atlas Coffee Club'],
    cacRange: '$35-$120',
    ltv: '$300-$900',
    barriers: ['churn management', 'shipping costs', 'freshness logistics'],
    opportunities: ['taste quiz personalization', 'sampler boxes', 'pause/skip UX'],
    scoringFactors: { problem: 55, underserved: 60, demand: 65, differentiation: 60, economics: 58, gtm: 65 },
    relevantSkills: ['branding', 'ecommerce', 'lifecycle marketing']
  },
  {
    id: 'dtc.pet-treat-subscription',
    category: BusinessModelType.DTC_SUBSCRIPTION,
    label: 'Pet Treat Subscription',
    description: 'Functional treats (allergies, hip health) with vet-backed content and bundles',
    tam: '$12B (pet treats; subscription subset fast-growing)',
    growth: '11% CAGR',
    competition: 'Moderate - fragmented DTC and marketplaces',
    majorCompetitors: ['BarkBox', 'Chewy Autoship', 'PetPlate'],
    cacRange: '$40-$110',
    ltv: '$250-$800',
    barriers: ['returns/quality control', 'ingredient sourcing', 'regulatory labeling'],
    opportunities: ['functional SKUs', 'bundles & cross-sell', 'UGC & community'],
    scoringFactors: { problem: 58, underserved: 62, demand: 64, differentiation: 62, economics: 60, gtm: 66 },
    relevantSkills: ['brand storytelling', 'influencer marketing', 'supply chain basics']
  },
  // Additional subscription pivots (from corrected spec)
  {
    id: 'specialty-food-subscriptions',
    category: BusinessModelType.DTC_SUBSCRIPTION,
    label: 'Specialty Food Subscriptions',
    description: 'Curated food products with educational content and sourcing stories',
    tam: '$8B (specialty food subscription market)',
    growth: '15% CAGR, premium food consciousness growing',
    competition: 'Moderate - category specialization available',
    majorCompetitors: ['Blue Apron', 'HelloFresh', 'Trade Coffee', 'Atlas Coffee'],
    cacRange: '-',
    ltv: '-',
    barriers: ['Inventory management', 'Shipping costs', 'Seasonal sourcing'],
    opportunities: ['Dietary specialization', 'Sustainability focus', 'Educational content'],
    scoringFactors: { problem: 55, underserved: 50, demand: 65, differentiation: 60, economics: 55, gtm: 60 },
    relevantSkills: []
  },
  {
    id: 'artisan-craft-subscriptions',
    category: BusinessModelType.DTC_SUBSCRIPTION,
    label: 'Artisan Craft Subscriptions',
    description: 'Monthly delivery of handmade items with maker stories and techniques',
    tam: '$2.5B (craft subscription subset)',
    growth: '12% CAGR, handmade appreciation trend',
    competition: 'Low - highly fragmented market',
    majorCompetitors: ["Annie's Kit Club", 'Craftsy', 'KiwiCo (adjacent)'],
    cacRange: '-',
    ltv: '-',
    barriers: ['Artisan coordination', 'Quality consistency', 'Shipping fragility'],
    opportunities: ['Skill development focus', 'Local artisan partnerships', 'Gift market'],
    scoringFactors: { problem: 60, underserved: 65, demand: 55, differentiation: 70, economics: 50, gtm: 55 },
    relevantSkills: []
  },
  {
    id: 'wellness-lifestyle-subscriptions',
    category: BusinessModelType.DTC_SUBSCRIPTION,
    label: 'Wellness & Lifestyle Subscriptions',
    description: 'Health-focused products with personalization and wellness education',
    tam: '$12B (wellness subscription market)',
    growth: '18% CAGR, health consciousness accelerating',
    competition: 'High but segmentation opportunities',
    majorCompetitors: ['Ritual', 'Care/of', 'FabFitFun', 'Birchbox'],
    cacRange: '-',
    ltv: '-',
    barriers: ['Regulatory compliance', 'Personalization complexity', 'Customer acquisition costs'],
    opportunities: ['AI personalization', 'Clinical partnerships', 'Corporate wellness'],
    scoringFactors: { problem: 65, underserved: 55, demand: 75, differentiation: 60, economics: 65, gtm: 65 },
    relevantSkills: []
  },
  {
    id: 'b2b-office-subscriptions',
    category: BusinessModelType.DTC_SUBSCRIPTION,
    label: 'B2B Office Subscriptions',
    description: 'Workplace supplies and employee perks delivered to offices',
    tam: '$5B (office supply subscription)',
    growth: '10% CAGR, remote work driving demand',
    competition: 'Moderate - traditional suppliers dominant',
    majorCompetitors: ['Amazon Business', 'Staples', 'Grubhub Corporate'],
    cacRange: '-',
    ltv: '-',
    barriers: ['B2B sales cycles', 'Procurement integration', 'Volume pricing pressure'],
    opportunities: ['Remote work packages', 'Employee wellness', 'Sustainability focus'],
    scoringFactors: { problem: 70, underserved: 60, demand: 70, differentiation: 55, economics: 75, gtm: 50 },
    relevantSkills: []
  }
];

export const SERVICES_PIVOTS: CategoryPivotOption[] = [
  {
    id: 'services.ai-leadgen-agency',
    category: BusinessModelType.SERVICES,
    label: 'AI-Powered Lead Gen Agency',
    description: 'Outbound + warm-up + personalization with strict deliverables and transparent reporting',
    tam: '$4B (SMB lead gen services)',
    growth: '7% CAGR',
    competition: 'High - commoditized, but execution and niche focus win',
    majorCompetitors: ['CIENCE', 'Belkins', 'Martal Group'],
    cacRange: '$0-$300 (service referrals and outbound)',
    ltv: '$8,000-$30,000',
    barriers: ['client churn risk', 'results dependency', 'deliverability constraints'],
    opportunities: ['vertical focus', 'SOPs and playbooks', 'rev-share pricing'],
    scoringFactors: { problem: 68, underserved: 60, demand: 62, differentiation: 58, economics: 70, gtm: 62 },
    relevantSkills: ['sales ops', 'copywriting', 'data enrichment']
  },
  {
    id: 'services.compliance-docs',
    category: BusinessModelType.SERVICES,
    label: 'Compliance Documentation Service',
    description: 'Packaged compliance docs with expert review for SMEs (SOC2-lite, HIPAA-readiness)',
    tam: '$3B (compliance advisory for SMBs)',
    growth: '8% CAGR',
    competition: 'Moderate - fragmented boutiques',
    majorCompetitors: ['Vanta (software)', 'Drata (software)', 'Local consultancies'],
    cacRange: '$300-$900',
    ltv: '$10,000-$40,000',
    barriers: ['expertise requirements', 'liability/risk management'],
    opportunities: ['productized service tiers', 'audit partnerships', 'template libraries'],
    scoringFactors: { problem: 72, underserved: 65, demand: 60, differentiation: 62, economics: 78, gtm: 55 },
    relevantSkills: ['compliance', 'technical writing', 'project management']
  }
];

export interface PivotAnalysisRequest {
  originalIdea: string;
  currentScore: number; // 0..100
  businessModel: BusinessModelClassification;
  userProfile?: { skills: string[]; interests: string[]; experience: string[] };
}

export interface PivotScore {
  option: CategoryPivotOption;
  overall: number; // 0..100
  delta: number; // overall - currentScore
  scoringBreakdown: Record<string, number>;
  skillMatch: number; // 0..1
}

export function generateBusinessModelAwarePivots(req: PivotAnalysisRequest): PivotScore[] {
  let candidatePivots: CategoryPivotOption[] = [];

  switch (req.businessModel.primaryType) {
    case BusinessModelType.ENTERPRISE_SAAS:
      candidatePivots = ENTERPRISE_SAAS_PIVOTS;
      break;
    case BusinessModelType.FOOD_SERVICE:
      candidatePivots = FOOD_SERVICE_PIVOTS;
      break;
    case BusinessModelType.PHYSICAL_PRODUCT:
      candidatePivots = PHYSICAL_PRODUCT_PIVOTS;
      break;
    case BusinessModelType.MARKETPLACE:
      candidatePivots = MARKETPLACE_PIVOTS;
      break;
    case BusinessModelType.SAAS_B2B:
      {
        const t = (req.originalIdea || '').toLowerCase();
        const hasEnterpriseSignals = t.includes('enterprise') || t.includes('fortune') || t.includes('$100k') || t.includes('$1m') || /\$\d{2,3}k/.test(t) || /\$\d+m/.test(t);
        candidatePivots = hasEnterpriseSignals ? ENTERPRISE_SAAS_PIVOTS : SAAS_PIVOTS;
      }
      break;
    case BusinessModelType.HEALTHCARE:
      candidatePivots = HEALTHCARE_PIVOTS;
      break;
      case BusinessModelType.FINTECH:
        candidatePivots = FINTECH_PIVOTS;
        break;
    case BusinessModelType.EDTECH:
      candidatePivots = EDTECH_PIVOTS;
      break;
    case BusinessModelType.MOBILE_APP:
      {
        // Curated pivot ID sets by mobile sub-vertical
        const fitnessIds = new Set([
          'mobile.habit-tracker',
          'mobile.corporate-wellness-b2b2c',
          'mobile.physical-therapy-rehab',
          'mobile.senior-fitness-fall-prevention',
          'mobile.youth-sports-training',
          'mobile.prenatal-postpartum-fitness',
        ]);
        const genericIds = new Set([
          'mobile.habit-tracker',
          'mobile.creator-video-tools',
          'mobile.offline-field-data',
        ]);
        const mentalWellnessIds = new Set([
          'mobile.habit-tracker',
          'mobile.corporate-wellness-b2b2c',
        ]);
        const productivityIds = new Set([
          'mobile.habit-tracker',
          'mobile.offline-field-data',
        ]);

        const sub = req.businessModel.subType || '';
        const pickSet = ((): Set<string> => {
          switch (sub) {
            case 'fitness-wellness':
              return fitnessIds;
            case 'mental-wellness':
              return mentalWellnessIds;
            case 'productivity':
              return productivityIds;
            case 'personal-finance':
            case 'gaming':
            case 'dating-social':
            default:
              return genericIds;
          }
        })();

        candidatePivots = MOBILE_APP_PIVOTS.filter((p) => pickSet.has(p.id));
      }
      break;
    case BusinessModelType.DTC_SUBSCRIPTION:
      candidatePivots = DTC_SUBSCRIPTION_PIVOTS;
      break;
    case BusinessModelType.SERVICES:
      candidatePivots = SERVICES_PIVOTS;
      break;
    default:
      candidatePivots = [
        ...FOOD_SERVICE_PIVOTS,
        ...SAAS_PIVOTS,
        ...MARKETPLACE_PIVOTS,
        ...PHYSICAL_PRODUCT_PIVOTS,
        ...DTC_SUBSCRIPTION_PIVOTS,
        ...SERVICES_PIVOTS,
        ...EDTECH_PIVOTS,
        ...MOBILE_APP_PIVOTS,
        ...HEALTHCARE_PIVOTS,
          ...FINTECH_PIVOTS,
      ];
  }

  // Detect artisan context early (independent of model classification to handle misclassification cases)
  const ideaLowerGlobal = (req.originalIdea || '').toLowerCase();
  const artisanSignalsGlobal = /(handmade|leather|artisan|craft|crafted|bespoke|custom)/i.test(ideaLowerGlobal);

  // Remove clearly unrelated regulated sectors if artisan signals present (even if misclassified as SaaS/Services)
  if (artisanSignalsGlobal) {
    candidatePivots = candidatePivots.filter(p => !(
      (/fintech|bank|payment|lending/i.test(p.label) || p.category === BusinessModelType.FINTECH ||
       /clinic|therapy|care|patient|health/i.test(p.label) || p.category === BusinessModelType.HEALTHCARE)
    ));
  }

  // Domain-specific augmentation only when confidently physical product
  if (req.businessModel.primaryType === BusinessModelType.PHYSICAL_PRODUCT && artisanSignalsGlobal) {
      const artisanPivots: CategoryPivotOption[] = [
        {
          id: 'physical.artisan-marketplace',
          category: BusinessModelType.MARKETPLACE,
          label: 'Premium Artisan Goods Marketplace',
          description: 'Curated platform for high-end handcrafted leather & accessory brands',
          tam: '$5B (luxury artisan accessories online)',
          growth: '10% CAGR',
          competition: 'Fragmented boutiques & Etsy saturation',
          majorCompetitors: ['Etsy (generic)', '1stDibs (luxury decor)', 'NuOrder (B2B)'],
          cacRange: '$120-$300',
          ltv: '$1,200-$3,500',
          barriers: ['Supply curation', 'Trust & authenticity', 'Fulfillment SLAs'],
          opportunities: ['Brand storytelling engine', 'Authentication layer', 'Limited drops'],
          scoringFactors: { problem: 58, underserved: 62, demand: 70, differentiation: 72, economics: 65, gtm: 60 },
          relevantSkills: ['craftsmanship', 'branding', 'marketplace ops']
        },
        {
          id: 'physical.corporate-gifting-platform',
          category: BusinessModelType.PHYSICAL_PRODUCT,
          label: 'Bespoke Corporate Gifting Service',
          description: 'Personalized premium leather gift kits for enterprise onboarding & retention',
          tam: '$22B (corporate gifting)',
          growth: '8% CAGR',
          competition: 'Moderate – swag aggregators',
          majorCompetitors: ['Swag.com', 'Gemnote', 'Postal'],
          cacRange: '$300-$800',
          ltv: '$10,000-$40,000',
          barriers: ['Procurement cycles', 'Inventory risk'],
          opportunities: ['Sustainability angle', 'On-demand personalization', 'Usage analytics'],
          scoringFactors: { problem: 60, underserved: 60, demand: 68, differentiation: 70, economics: 78, gtm: 58 },
          relevantSkills: ['b2b sales', 'supply chain', 'craftsmanship']
        },
        {
          id: 'physical.vertical-industry-gear',
          category: BusinessModelType.PHYSICAL_PRODUCT,
          label: 'Vertical-Specific Custom Leather Gear',
          description: 'Highly durable, branded field & travel gear for tech execs / creative pros',
          tam: '$3B (premium work accessories)',
          growth: '7% CAGR',
          competition: 'Brand-heavy incumbents',
          majorCompetitors: ['Bellroy', 'Tumi', 'Saddleback'],
          cacRange: '$140-$280',
          ltv: '$900-$2,400',
          barriers: ['Material sourcing', 'Brand trust'],
          opportunities: ['Modular inserts', 'RFID / tracker integration', 'Limited collabs'],
          scoringFactors: { problem: 55, underserved: 58, demand: 62, differentiation: 74, economics: 64, gtm: 57 },
          relevantSkills: ['design', 'craftsmanship', 'brand storytelling']
        },
        {
          id: 'physical.sustainable-supply-brand',
          category: BusinessModelType.PHYSICAL_PRODUCT,
          label: 'Traceable Sustainable Leather Brand',
          description: 'Full supply-chain transparency & upcycled / regenerative sourcing',
          tam: '$6B (ethical leather subset)',
          growth: '11% CAGR',
          competition: 'Growing – limited verification tooling',
          majorCompetitors: ['Allbirds (analog)', 'Nisolo', 'Patagonia accessories'],
          cacRange: '$130-$260',
          ltv: '$1,500-$3,000',
          barriers: ['Certification costs', 'Material availability'],
          opportunities: ['Tokenized provenance', 'Repair / refurb loop', 'Corporate ESG gifting'],
          scoringFactors: { problem: 57, underserved: 63, demand: 66, differentiation: 76, economics: 61, gtm: 60 },
          relevantSkills: ['sustainable sourcing', 'supply chain', 'branding']
        }
      ];
      // Merge (avoid duplicates by id)
      const existingIds = new Set(candidatePivots.map(p => p.id));
      for (const ap of artisanPivots) if (!existingIds.has(ap.id)) candidatePivots.push(ap);
      // Final safety pass (idempotent)
      candidatePivots = candidatePivots.filter(p => !(
        (/fintech|bank|payment|lending/i.test(p.label) || p.category === BusinessModelType.FINTECH ||
        /clinic|therapy|care|patient|health/i.test(p.label) || p.category === BusinessModelType.HEALTHCARE)
      ));
  }

  const scored = candidatePivots.map((option) => {
    const overall = calculateOverallScore(option.scoringFactors);
    const delta = overall - req.currentScore;
    const skillMatch = calculateSkillMatch(option.relevantSkills, req.userProfile?.skills || []);
    return { option, overall, delta, scoringBreakdown: option.scoringFactors, skillMatch } as PivotScore;
  });

  return scored
    .filter((p) => p.delta >= 15)
    .sort((a, b) => (b.overall + b.skillMatch * 10) - (a.overall + a.skillMatch * 10))
    .slice(0, 4);
}

export function calculateOverallScore(factors: Record<string, number>): number {
  const weights: Record<string, number> = {
    problem: 0.2,
    underserved: 0.15,
    demand: 0.25,
    differentiation: 0.15,
    economics: 0.15,
    gtm: 0.1,
  };
  let weighted = 0;
  for (const [k, w] of Object.entries(weights)) weighted += (factors[k] || 0) * w;
  return Math.round(weighted);
}

// Alias to maintain naming from external specs
export function calculatePivotScore(factors: Record<string, number>): number {
  return calculateOverallScore(factors);
}

export function getPivotsForBusinessModel(modelType: BusinessModelType): CategoryPivotOption[] {
  switch (modelType) {
    case BusinessModelType.ENTERPRISE_SAAS:
      return ENTERPRISE_SAAS_PIVOTS;
    case BusinessModelType.FOOD_SERVICE:
      return FOOD_SERVICE_PIVOTS;
    case BusinessModelType.PHYSICAL_PRODUCT:
      return PHYSICAL_PRODUCT_PIVOTS;
    case BusinessModelType.MARKETPLACE:
      return MARKETPLACE_PIVOTS;
    case BusinessModelType.SAAS_B2B:
      return SAAS_PIVOTS;
    case BusinessModelType.HEALTHCARE:
      return HEALTHCARE_PIVOTS;
      case BusinessModelType.FINTECH:
        return FINTECH_PIVOTS;
    case BusinessModelType.EDTECH:
      return EDTECH_PIVOTS;
    case BusinessModelType.MOBILE_APP:
      return MOBILE_APP_PIVOTS;
    case BusinessModelType.DTC_SUBSCRIPTION:
      return DTC_SUBSCRIPTION_PIVOTS;
    case BusinessModelType.SERVICES:
      return SERVICES_PIVOTS;
    default:
      return [];
  }
}

// Healthcare-specific validation wrapping existing generic logic
export function validateHealthcarePivotRelevance(
  businessModel: BusinessModelClassification,
  pivotOption: CategoryPivotOption
): { isValid: boolean; reason?: string } {
  if (pivotOption.category === businessModel.primaryType) return { isValid: true };
  const related = {
    [BusinessModelType.ENTERPRISE_SAAS]: [BusinessModelType.SAAS_B2B, BusinessModelType.HEALTHCARE, BusinessModelType.FINTECH],
    [BusinessModelType.FOOD_SERVICE]: [BusinessModelType.DTC_SUBSCRIPTION, BusinessModelType.SERVICES],
    [BusinessModelType.HEALTHCARE]: [BusinessModelType.SAAS_B2B],
    [BusinessModelType.FINTECH]: [BusinessModelType.SAAS_B2B],
    [BusinessModelType.EDTECH]: [BusinessModelType.SAAS_B2B, BusinessModelType.FINTECH],
    [BusinessModelType.DTC_SUBSCRIPTION]: [BusinessModelType.PHYSICAL_PRODUCT],
    [BusinessModelType.PHYSICAL_PRODUCT]: [BusinessModelType.DTC_SUBSCRIPTION],
    [BusinessModelType.MARKETPLACE]: [BusinessModelType.SERVICES],
    [BusinessModelType.SERVICES]: [BusinessModelType.MARKETPLACE, BusinessModelType.SAAS_B2B, BusinessModelType.FOOD_SERVICE],
    [BusinessModelType.SAAS_B2B]: [BusinessModelType.HEALTHCARE, BusinessModelType.FINTECH, BusinessModelType.EDTECH],
    [BusinessModelType.MOBILE_APP]: [BusinessModelType.SAAS_B2B],
  } as Record<BusinessModelType, BusinessModelType[]>;
  const allowed = related[businessModel.primaryType] || [];
  if (allowed.includes(pivotOption.category)) return { isValid: true };
  return { isValid: false, reason: `Pivot category "${pivotOption.category}" not compatible with business model "${businessModel.primaryType}"` };
}

export interface HealthcarePivotAnalysis {
  businessModel: BusinessModelClassification;
  validPivots: Array<{
    option: CategoryPivotOption;
    overall: number;
    delta: number;
    scoringBreakdown: Record<string, number>;
  }>;
  invalidPivots: Array<{
    option: CategoryPivotOption;
    reason: string;
  }>;
}

export function generateHealthcareValidatedPivots(
  ideaText: string,
  currentScore: number
): HealthcarePivotAnalysis {
  const businessModel = detectBusinessModelWithPriority(ideaText);
  const candidatePivots = getPivotsForBusinessModel(businessModel.primaryType);
  const validPivots: Array<{ option: CategoryPivotOption; overall: number; delta: number; scoringBreakdown: Record<string, number> }>
    = [];
  const invalidPivots: Array<{ option: CategoryPivotOption; reason: string }> = [];

  for (const pivot of candidatePivots) {
    const validation = validateHealthcarePivotRelevance(businessModel, pivot);
    if (validation.isValid) {
      const overall = calculatePivotScore(pivot.scoringFactors);
      const delta = overall - currentScore;
      if (delta >= 10) {
        validPivots.push({ option: pivot, overall, delta, scoringBreakdown: pivot.scoringFactors });
      }
    } else {
      invalidPivots.push({ option: pivot, reason: validation.reason || 'Validation failed' });
    }
  }

  validPivots.sort((a, b) => b.overall - a.overall);

  return { businessModel, validPivots: validPivots.slice(0, 4), invalidPivots };
}

// Dev-only: quick validation harness for detection
export function validateBusinessModelDetection() {
  const testCases = [
    {
      input: 'Ghost kitchen operation serving healthy meal delivery across Uber Eats and DoorDash from a commercial kitchen.',
      expectedType: BusinessModelType.FOOD_SERVICE,
      expectedConfidence: 0.8,
      description: 'Ghost kitchen / meal delivery',
    },
    {
      input: 'Monthly subscription box delivering artisanal coffee beans from different regions. Subscribers pay $35/month and receive 2-3 coffee varieties with tasting notes and brewing guides.',
      expectedType: BusinessModelType.DTC_SUBSCRIPTION,
      expectedConfidence: 0.8,
      description: 'Coffee subscription box',
    },
    {
      input: 'I plan to sell handmade leather bags and accessories online. Each bag costs $80-300 to make and I\'ll sell them for $200-800.',
      expectedType: BusinessModelType.PHYSICAL_PRODUCT,
      expectedConfidence: 0.85,
      description: 'Handmade physical products',
    },
    {
      input: 'Platform where freelance graphic designers offer services to small businesses. We take 15% commission.',
      expectedType: BusinessModelType.MARKETPLACE,
      expectedConfidence: 0.8,
      description: 'Freelance marketplace',
    },
    {
      input: 'Cloud-based project management software that teams pay $29/month to access.',
      expectedType: BusinessModelType.SAAS_B2B,
      expectedConfidence: 0.8,
      description: 'SaaS software',
    },
  ] as const;

  const details = testCases.map((tc) => {
    const r = detectBusinessModelWithPriority(tc.input);
    const passed = r.primaryType === tc.expectedType && r.confidence >= (tc.expectedConfidence - 0.1);
    return {
      description: tc.description,
      input: tc.input.slice(0, 50) + '...',
      expected: tc.expectedType,
      actual: r.primaryType,
      expectedConfidence: tc.expectedConfidence,
      actualConfidence: r.confidence,
      indicators: r.indicators,
      reasoning: r.reasoningChain,
      passed,
    };
  });

  const passed = details.filter((d) => d.passed).length;
  const failed = details.length - passed;
  return { passed, failed, details };
}

export function calculateSkillMatch(required: string[], user: string[]): number {
  if (!user || !user.length) return 0.5;
  const matches = required.filter((r) => user.some((u) => u.toLowerCase().includes(r.toLowerCase())));
  return matches.length / required.length;
}

export interface ValidationRequest {
  ideaText: string;
  currentValidation: { overall: number; dimensions: Record<string, number> };
  userProfile?: { skills: string[]; interests: string[]; experience: string[] };
  /**
   * Optional override from backend validation: use this business model classification
   * instead of re-detecting from idea text. Keeps pivot view consistent with server.
   */
  businessModelOverride?: BusinessModelClassification;
}

export async function generateContextualPivots(req: ValidationRequest) {
  const businessModel = req.businessModelOverride
    ? req.businessModelOverride
    : detectBusinessModelWithPriority(req.ideaText);
  const pivots = generateBusinessModelAwarePivots({
    originalIdea: req.ideaText,
    currentScore: req.currentValidation.overall,
    businessModel,
    userProfile: req.userProfile,
  });
  return {
    businessModel,
    pivots: pivots.map((p) => ({
      id: p.option.id,
      category: p.option.category,
      label: p.option.label,
      description: p.option.description,
      overall: p.overall,
      delta: p.delta,
      marketSnapshot: {
        tam: p.option.tam,
        growth: p.option.growth,
        competition: p.option.competition,
        competitors: p.option.majorCompetitors,
      },
      scoringBreakdown: p.scoringBreakdown,
      barriers: p.option.barriers,
      opportunities: p.option.opportunities,
      skillMatch: p.skillMatch,
    })),
    originalConstraints: businessModel.constraints,
  } as const;
}

export function validatePivotRecommendations(
  businessModel: BusinessModelClassification,
  pivots: PivotScore[]
): { isValid: boolean; errors: string[] } {
  const errors: string[] = [];
  // Allow related categories (e.g., physical -> dtc-subscription)
  const allowedByModel = {
    [BusinessModelType.ENTERPRISE_SAAS]: new Set([BusinessModelType.ENTERPRISE_SAAS, BusinessModelType.SERVICES, BusinessModelType.SAAS_B2B]),
    [BusinessModelType.FOOD_SERVICE]: new Set([BusinessModelType.FOOD_SERVICE, BusinessModelType.SERVICES, BusinessModelType.DTC_SUBSCRIPTION]),
    [BusinessModelType.PHYSICAL_PRODUCT]: new Set([BusinessModelType.PHYSICAL_PRODUCT, BusinessModelType.DTC_SUBSCRIPTION]),
    [BusinessModelType.DTC_SUBSCRIPTION]: new Set([BusinessModelType.DTC_SUBSCRIPTION, BusinessModelType.PHYSICAL_PRODUCT]),
    [BusinessModelType.MARKETPLACE]: new Set([BusinessModelType.MARKETPLACE, BusinessModelType.SERVICES]),
    [BusinessModelType.SAAS_B2B]: new Set([BusinessModelType.SAAS_B2B, BusinessModelType.SERVICES]),
    [BusinessModelType.SERVICES]: new Set([BusinessModelType.SERVICES, BusinessModelType.SAAS_B2B]),
    [BusinessModelType.MOBILE_APP]: new Set([BusinessModelType.MOBILE_APP, BusinessModelType.SAAS_B2B]),
    [BusinessModelType.FINTECH]: new Set([BusinessModelType.FINTECH, BusinessModelType.SAAS_B2B]),
    [BusinessModelType.HEALTHCARE]: new Set([BusinessModelType.HEALTHCARE, BusinessModelType.SAAS_B2B]),
    [BusinessModelType.EDTECH]: new Set([BusinessModelType.EDTECH, BusinessModelType.SAAS_B2B]),
  } as Record<BusinessModelType, Set<BusinessModelType>>;

  for (const p of pivots) {
    const allowed = allowedByModel[businessModel.primaryType] || new Set([businessModel.primaryType]);
    // If option has category, validate against it; otherwise skip category check (legacy objects)
    const optCategory = (p.option as CategoryPivotOption).category as BusinessModelType | undefined;
    if (optCategory && !allowed.has(optCategory)) {
      errors.push(`Pivot "${p.option.label}" category ${optCategory} not allowed for ${businessModel.primaryType}`);
    }
    if (!p.option.tam || p.option.tam === '—') errors.push(`Pivot "${p.option.label}" missing market data`);
    if (p.delta < 15) errors.push(`Pivot "${p.option.label}" improvement too small: ${p.delta}`);
  }

  return { isValid: errors.length === 0, errors };
}

// Display label helper for business model types
export function getBusinessModelDisplayLabel(model: BusinessModelType | string): string {
  const raw = String(model);
  const map: Record<string, string> = {
    [BusinessModelType.MOBILE_APP]: 'CONSUMER MOBILE APP',
    [BusinessModelType.DTC_SUBSCRIPTION]: 'DTC SUBSCRIPTION',
    [BusinessModelType.SAAS_B2B]: 'SAAS B2B',
    [BusinessModelType.ENTERPRISE_SAAS]: 'ENTERPRISE SAAS',
    [BusinessModelType.PHYSICAL_PRODUCT]: 'PHYSICAL PRODUCT',
    [BusinessModelType.FOOD_SERVICE]: 'FOOD SERVICE',
  };
  return map[raw] || raw.replace(/-/g, ' ').toUpperCase();
}
