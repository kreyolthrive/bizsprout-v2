// Vague Idea Detection System

export interface VaguenessAssessment {
  isVague: boolean;
  confidence: number;
  vaguenessScore: number;
  missingElements: string[];
  specificityPrompts: string[];
  examples: string[];
}

export interface IdeaSpecificity {
  hasCustomerSegment: boolean;
  hasSpecificProblem: boolean;
  hasConcreteProduct: boolean;
  hasBusinessModel: boolean;
  hasDeliveryMechanism: boolean;
  specificitySummary: {
    customer: number;
    problem: number;
    product: number;
    businessModel: number;
    delivery: number;
  };
}

// VAGUENESS INDICATORS
const VAGUE_TERMS = [
  'technology company',
  'tech startup',
  'innovative solution',
  'platform',
  'helps people',
  'make better decisions',
  'be more productive',
  'using ai',
  'using data',
  'machine learning',
  'leverage technology',
  'digital transformation',
  'optimize',
  'streamline',
  'improve efficiency',
  'better outcomes',
  'revolutionary',
  'disruptive',
  'next generation',
  'cutting-edge'
];

const SPECIFIC_INDICATORS = {
  customer: [
    'smb', 'small business', 'enterprise', 'b2b', 'b2c',
    'healthcare', 'finance', 'retail', 'manufacturing',
    'construction', 'legal', 'accounting', 'marketing',
    'sales teams', 'customer service', 'operations',
    'cfo', 'cto', 'manager', 'executive'
  ],
  problem: [
    'hours', 'minutes', 'cost', 'waste', 'error', 'delay',
    'manual', 'spreadsheet', 'duplicate', 'missing',
    'compliance', 'regulation', 'audit', 'risk'
  ],
  product: [
    'dashboard', 'mobile app', 'chrome extension', 'api',
    'widget', 'integration', 'automation', 'workflow',
    'template', 'calculator', 'analyzer', 'scanner',
    'generator', 'builder', 'editor', 'tracker'
  ],
  businessModel: [
    '$', 'subscription', 'per month', 'per user', 'per seat',
    'commission', 'transaction fee', 'freemium', 'enterprise',
    'pricing', 'revenue', 'monetize'
  ],
  delivery: [
    'saas', 'web app', 'mobile', 'ios', 'android',
    'desktop', 'plugin', 'marketplace', 'platform',
    'cloud', 'on-premise', 'api', 'sdk'
  ]
} as const;

export function analyzeIdeaSpecificity(ideaText: string): IdeaSpecificity {
  const text = (ideaText || '').toLowerCase();

  const hasCustomerSegment = SPECIFIC_INDICATORS.customer.some((term) => text.includes(term));
  const hasSpecificProblem = SPECIFIC_INDICATORS.problem.some((term) => text.includes(term));
  const hasConcreteProduct = SPECIFIC_INDICATORS.product.some((term) => text.includes(term));
  const hasBusinessModel = SPECIFIC_INDICATORS.businessModel.some((term) => text.includes(term));
  const hasDeliveryMechanism = SPECIFIC_INDICATORS.delivery.some((term) => text.includes(term));

  // 0-10 scale per dimension
  const customerScore = hasCustomerSegment ? 7 : 0;
  const problemScore = hasSpecificProblem ? 8 : 0;
  const productScore = hasConcreteProduct ? 7 : 0;
  const businessModelScore = hasBusinessModel ? 6 : 0;
  const deliveryScore = hasDeliveryMechanism ? 5 : 0;

  return {
    hasCustomerSegment,
    hasSpecificProblem,
    hasConcreteProduct,
    hasBusinessModel,
    hasDeliveryMechanism,
    specificitySummary: {
      customer: customerScore,
      problem: problemScore,
      product: productScore,
      businessModel: businessModelScore,
      delivery: deliveryScore,
    },
  };
}

export function assessVagueness(ideaText: string): VaguenessAssessment {
  const specificity = analyzeIdeaSpecificity(ideaText);
  const text = (ideaText || '').toLowerCase();

  // Count vague terms
  const vagueTermCount = VAGUE_TERMS.filter((term) => text.includes(term)).length;

  // Total specificity 0-100
  const totalSpecificity =
    (Object.values(specificity.specificitySummary).reduce((sum, score) => sum + score, 0) / 5) * 10;

  // Vagueness score increases with vague terms and decreases with specificity
  const vaguenessScore = Math.max(0, vagueTermCount * 10 - totalSpecificity);

  // Thresholds: vagueness > 40 or specificity < 30
  const isVague = vaguenessScore > 40 || totalSpecificity < 30;

  const missingElements: string[] = [];
  const specificityPrompts: string[] = [];
  const examples: string[] = [];

  if (!specificity.hasCustomerSegment) {
    missingElements.push('Customer Segment');
    specificityPrompts.push('Who specifically will use this? (e.g., "SMB sales teams in B2B SaaS companies")');
    examples.push('❌ "helps people" → ✅ "helps Series A startup CFOs"');
  }

  if (!specificity.hasSpecificProblem) {
    missingElements.push('Concrete Problem');
    specificityPrompts.push('What exact pain point are you solving? Include metrics if possible (e.g., "Salespeople waste 2 hours/day on manual CRM data entry")');
    examples.push('❌ "be more productive" → ✅ "eliminate 10 hours/week of manual invoice processing"');
  }

  if (!specificity.hasConcreteProduct) {
    missingElements.push('Specific Product');
    specificityPrompts.push('What exactly will you build? (e.g., "Chrome extension that auto-fills CRM fields from LinkedIn profiles")');
    examples.push('❌ "technology platform" → ✅ "Slack bot that schedules meetings via natural language"');
  }

  if (!specificity.hasBusinessModel) {
    missingElements.push('Business Model');
    specificityPrompts.push('How will you charge customers? (e.g., "$49/month per user" or "15% commission on transactions")');
    examples.push('❌ unspecified revenue → ✅ "$199/month flat fee for up to 10 users"');
  }

  if (!specificity.hasDeliveryMechanism) {
    missingElements.push('Delivery Mechanism');
    specificityPrompts.push('How will customers access this? (e.g., "Web dashboard" or "iOS mobile app")');
    examples.push('❌ "using AI" → ✅ "API that integrates with existing ERP systems"');
  }

  return {
    isVague,
    confidence: totalSpecificity,
    vaguenessScore,
    missingElements,
    specificityPrompts,
    examples,
  };
}
