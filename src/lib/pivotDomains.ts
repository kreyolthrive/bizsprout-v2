// Domain intelligence snapshots used for pivot analysis
export interface DomainSnapshot {
  label: string;
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
}

export const PIVOT_DOMAINS: Record<string, DomainSnapshot> = {
  'healthcare-practice': {
    label: 'Healthcare Practice Management',
    tam: '$45B (clinical workflow software)',
    growth: '12% CAGR, accelerated by telehealth adoption',
    competition: 'Moderate - fragmented by specialty',
    majorCompetitors: ['Epic', 'Cerner', 'athenahealth', 'DrChrono'],
    cacRange: '$800-$2,400',
    ltv: '$18,000-$45,000',
    barriers: ['HIPAA compliance', 'Integration complexity', 'Long sales cycles'],
    opportunities: ['Specialty-specific workflows', 'Patient engagement', 'Telehealth integration'],
    scoringFactors: { problem: 75, underserved: 65, demand: 70, differentiation: 60, economics: 80, gtm: 55 },
  },
  'fintech-b2b': {
    label: 'Small Business Financial Tools',
    tam: '$180B (business financial software)',
    growth: '15% CAGR, driven by SMB digitization',
    competition: 'High but specialized niches available',
    majorCompetitors: ['QuickBooks', 'Stripe', 'Square', 'Xero'],
    cacRange: '$200-$600',
    ltv: '$8,000-$25,000',
    barriers: ['Financial regulations', 'Integration requirements', 'Trust/security'],
    opportunities: ['Industry-specific accounting', 'Cash flow automation', 'Embedded finance'],
    scoringFactors: { problem: 70, underserved: 55, demand: 80, differentiation: 65, economics: 75, gtm: 70 },
  },
  'construction-mgmt': {
    label: 'Construction Project Management',
    tam: '$2.8B (construction software)',
    growth: '10% CAGR, technology adoption lag creates opportunity',
    competition: 'Moderate - legacy systems dominant',
    majorCompetitors: ['Procore', 'Autodesk Construction Cloud', 'PlanGrid'],
    cacRange: '$1,500-$4,000',
    ltv: '$25,000-$60,000',
    barriers: ['Field/office workflow complexity', 'Mobile requirements', 'Integration challenges'],
    opportunities: ['Trade-specific tools', 'Mobile-first design', 'IoT integration'],
    scoringFactors: { problem: 80, underserved: 70, demand: 65, differentiation: 70, economics: 85, gtm: 60 },
  },
  'legal-practice': {
    label: 'Legal Practice Management',
    tam: '$7.2B (legal technology)',
    growth: '8% CAGR, accelerated by remote work',
    competition: 'Moderate - practice size segmentation',
    majorCompetitors: ['Clio', 'MyCase', 'PracticePanther', 'Smokeball'],
    cacRange: '$600-$1,800',
    ltv: '$15,000-$35,000',
    barriers: ['Compliance requirements', 'Document security', 'Bar regulations'],
    opportunities: ['Practice area specialization', 'Court integrations', 'Client portals'],
    scoringFactors: { problem: 70, underserved: 60, demand: 65, differentiation: 65, economics: 75, gtm: 65 },
  },
  'ecommerce-ops': {
    label: 'E-commerce Operations Software',
    tam: '$24B (e-commerce software)',
    growth: '22% CAGR, driven by online retail growth',
    competition: 'High but vertical niches available',
    majorCompetitors: ['Shopify', 'Amazon Seller Tools', 'SkuVault', 'TradeGecko'],
    cacRange: '$150-$800',
    ltv: '$6,000-$18,000',
    barriers: ['Platform integrations', 'Inventory complexity', 'Seasonal volatility'],
    opportunities: ['Marketplace automation', 'Inventory optimization', 'Fulfillment coordination'],
    scoringFactors: { problem: 65, underserved: 50, demand: 85, differentiation: 55, economics: 65, gtm: 75 },
  },
  'field-service': {
    label: 'Field Service Management',
    tam: '$5.1B (field service software)',
    growth: '14% CAGR, IoT and mobile driving adoption',
    competition: 'Moderate - fragmented by industry',
    majorCompetitors: ['ServiceTitan', 'Jobber', 'Housecall Pro', 'ServiceMax'],
    cacRange: '$800-$2,200',
    ltv: '$20,000-$45,000',
    barriers: ['Mobile complexity', 'Integration requirements', 'Training overhead'],
    opportunities: ['Trade specialization', 'IoT integration', 'Customer self-service'],
    scoringFactors: { problem: 75, underserved: 65, demand: 70, differentiation: 70, economics: 80, gtm: 65 },
  },
};
