// pages/api/validate.ts
import type { NextApiResponse } from 'next';
import { randomUUID as nodeRandomUUID } from 'crypto';
import { withValidation, type SanitizedRequest } from '@/lib/middleware/validation.middleware';
import { ensureCsrf } from '@/lib/csrfMiddleware';
import { evaluateAdaptive, inferModelFromHints } from '@/lib/adaptiveValidation';
import { decidePolicy, getValidationCriteria } from '@/lib/adaptive/policy';
import { InMemoryRuleEngine } from '@/lib/adaptive/runtime';
import type { RuleDefinition } from '@/lib/adaptive/ports';
import { getKV } from '@/lib/redis';
// Defer Supabase imports to runtime to avoid crashes when env is missing during local/tests
import { simulatePayback, simulateLTVCAC } from '@/lib/adaptiveSimulation';
// Lightweight in-memory rate limiter for this endpoint (avoids external deps)
const __validateBuckets = new Map<string, { resetAt: number; count: number }>();
const VALIDATE_CAP = Number(process.env.VALIDATE_RATE_LIMIT || process.env.RATE_LIMIT || 20);
const VALIDATE_WINDOW_MS = Number(process.env.VALIDATE_RATE_WINDOW_MS || process.env.RATE_WINDOW_MS || 60_000);
async function validateLimiter(key: string): Promise<{ success: boolean; remaining: number; reset: number }>{
  const now = Date.now();
  let b = __validateBuckets.get(key);
  if (!b || now >= b.resetAt) b = { resetAt: now + VALIDATE_WINDOW_MS, count: 0 };
  b.count += 1;
  __validateBuckets.set(key, b);
  return { success: b.count <= VALIDATE_CAP, remaining: Math.max(0, VALIDATE_CAP - b.count), reset: b.resetAt };
}
// Lazy-load heavy modules inside the handler to ensure JSON errors even if imports fail
import type { ValidationInput } from '../../src/lib/hybrid/validation-types';

// CORS helper
function allowOrigin(res: NextApiResponse) {
  const origins = (process.env.ALLOW_ORIGIN || '').split(',').map(x => x.trim()).filter(Boolean);
  const origin = origins[0] || '*';
  res.setHeader('Access-Control-Allow-Origin', origin);
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'content-type');
}

async function handler(req: SanitizedRequest, res: NextApiResponse) {
  allowOrigin(res);
  // Disable caches for this endpoint
  res.setHeader('Cache-Control', 'no-store');
  if (req.method === 'OPTIONS') {
    await ensureCsrf(req, res);
    return res.status(204).end();
  }
  if (req.method === 'GET') {
    await ensureCsrf(req, res);
    return res.status(200).json({ ok: true });
  }
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  // Enforce JSON content-type
  const ct = String(req.headers['content-type'] || '').toLowerCase();
  if (!ct.includes('application/json')) {
    return res.status(415).json({ error: 'Unsupported Media Type. Use application/json' });
  }

  // Enforce CSRF on state-changing request
  const ok = await ensureCsrf(req, res);
  if (!ok) return;

  // Basic IP extraction for rate limiting
  const xfwd = String(req.headers['x-forwarded-for'] || '');
  const ip = (xfwd.split(',')[0] || req.socket.remoteAddress || 'unknown').toString();
  if (process.env.DISABLE_RATELIMIT !== '1') {
    try {
      const { success, remaining, reset } = await validateLimiter(`validate:${ip}`);
      res.setHeader('X-RateLimit-Remaining', String(remaining));
      res.setHeader('X-RateLimit-Reset', String(reset));
      if (!success) {
        const retryAfter = Math.max(1, Math.ceil((reset - Date.now()) / 1000));
        res.setHeader('Retry-After', String(retryAfter));
        // include requestId for tracing
        res.setHeader('X-Request-Id', (req as SanitizedRequest).requestId || '');
        return res.status(429).json({ error: 'Too many requests' });
      }
    } catch {
      // Fail-open on limiter errors but do not leak details
    }
  }

  try {
    // Dynamically import heavy modules so errors are caught and returned as JSON
    const [hybridMod, adaptiveMod, marketMod, financialMod] = await Promise.all([
      import('../../src/lib/hybrid/hybridValidation'),
      import('@/lib/adaptiveMultiAIValidator').catch(() => ({} as any)),
      import('@/lib/marketSaturation').catch(() => ({} as any)),
      import('../../src/lib/financialValidator').catch(() => ({} as any)),
    ]);

    const { HybridValidationService, makeDemoInputFromText } = hybridMod as typeof import('../../src/lib/hybrid/hybridValidation');
    const { AdaptiveMultiAIValidator, EnhancedMultiAIValidator } = adaptiveMod as typeof import('@/lib/adaptiveMultiAIValidator');
    const { assessMarketSaturation } = marketMod as typeof import('@/lib/marketSaturation');
    const { FinancialValidator } = financialMod as typeof import('../../src/lib/financialValidator');
    const body = req.body || {};
    const sanitizedIdea = (req.sanitizedBody && req.sanitizedBody.ideaText) ? req.sanitizedBody.ideaText : undefined;
    const ideaSrc = typeof body.idea === 'string' ? body.idea : undefined;
    const idea = sanitizedIdea || ideaSrc;
    const { title, target_market, pricing, price_point, ...additionalFields } = body;
    
    if (!idea || typeof idea !== 'string' || !idea.trim()) {
      return res.status(400).json({ error: 'Idea description is required' });
    }
    if (idea.length > 4000) {
      return res.status(413).json({ error: 'Idea is too large (max 4000 characters)' });
    }

    // Construct the full idea text with context
  let fullIdeaText = idea.trim();
    if (title) fullIdeaText = `${title}: ${fullIdeaText}`;
    if (target_market) fullIdeaText += ` Target: ${target_market}`;
    if (pricing || price_point) fullIdeaText += ` Pricing: $${pricing || price_point}`;

    // Build hybrid input (use helper for sane defaults, then enrich with request fields)
  const baseInput: ValidationInput = makeDemoInputFromText(fullIdeaText);
    const hybridInput: ValidationInput = {
      ...baseInput,
      price_point: typeof pricing === 'number' ? pricing : typeof price_point === 'number' ? price_point : baseInput.price_point,
      target_customer: target_market || baseInput.target_customer,
    };

    // Run validation using Enhanced Multi-AI Validator by default for maximum accuracy
    // Fall back to AdaptiveMultiAIValidator if enhanced mode is disabled
    // Use HybridValidationService only if adaptive validation is completely disabled
    let result: any;
    if (process.env.ADAPTIVE_VALIDATOR === '0') {
      // Explicitly disabled - use basic Hybrid only
      const hybridService = new HybridValidationService();
      result = await hybridService.validateBusinessIdea(hybridInput);
    } else if (process.env.ADAPTIVE_VALIDATOR_MODE === 'basic') {
      // Use basic adaptive validator
      const adaptive = new AdaptiveMultiAIValidator();
      result = await adaptive.validate(hybridInput);
    } else {
      // Default to EnhancedMultiAIValidator for best accuracy
      const enhanced = new EnhancedMultiAIValidator();
      result = await enhanced.validate(hybridInput);
    }

  // Normalize and map scores (preserve decimals as provided by Hybrid)
  const baseDemandScore = typeof result.scores.demand_signals === 'number' ? result.scores.demand_signals : 5;
  const moatScore = typeof result.scores.differentiation === 'number' ? result.scores.differentiation : 4;
  const distributionScore = typeof result.scores.gtm === 'number' ? result.scores.gtm : 5;
  const baseEconomicsScore = typeof result.scores.willingness_to_pay === 'number' ? result.scores.willingness_to_pay : 4;

    // Underserved heuristic from saturation (0-100 → 0-100)
  const saturationPct = Math.max(0, Math.min(100, Math.round(100 - (result.scores.underserved * 10))));
    // We'll compute underservedPct later after considering category overrides

    // Status will be determined after computing normalized/clamped scores

    const risks: string[] = [];
    if (saturationPct >= 80) {
      risks.push(
        `High saturation (${saturationPct}%) with large incumbents likely present`
      );
    }

    // Construct response in existing API shape
  const econ = {
      ltv: (hybridInput.ltv_estimate ?? 0) || undefined,
      ltvCacRatio: (hybridInput.ltv_estimate && hybridInput.cac_estimate && hybridInput.cac_estimate > 0) ? (hybridInput.ltv_estimate / hybridInput.cac_estimate) : undefined,
      paybackMonths: undefined as number | undefined,
      assumptions: {
        marketCAC: hybridInput.cac_estimate,
        churnRate: undefined as number | undefined,
      }
    };
  const assumptions = econ.assumptions;
  // Detect generic project management and generic freelance/creative marketplaces to enrich market context
  const ideaLower = (fullIdeaText || '').toLowerCase();
  // Detect physical subscription boxes (specifically coffee)
  const physicalBoxKeywords = /(subscription box|monthly box|coffee club|coffee subscription|bean subscription|coffee box|monthly coffee|roastery|roaster|beans|single[- ]origin|espresso|drip|pour[- ]?over|keurig|k[- ]?cup|french press|grind size|roast level)/i;
  const shippingIndicators = /(ship|shipping|deliver|box|package|fulfillment|3pl|warehouse|inventory|stock)/i;
  const isPhysicalSubscription = (/(subscription|subscribe|monthly|quarterly)/i.test(ideaLower) && (shippingIndicators.test(ideaLower) || /box|crate|pack|bag/.test(ideaLower)))
    || physicalBoxKeywords.test(ideaLower);
  const isCoffeeSubscription = isPhysicalSubscription && /(coffee|beans|roast|roastery|espresso|single[- ]origin|blend|arabica|robusta)/i.test(ideaLower);
  const isProjectManagement = /\b(project management|kanban|task tracking)\b/.test(ideaLower);
  const isCustomerSupport = /\b(customer support|help ?desk|support ticket|ticketing)\b/.test(ideaLower) ||
    /\b(zendesk|freshdesk|intercom|help ?scout|service ?now|jira service management)\b/.test(ideaLower);
  const mentionsMarketplace = /\bmarketplace\b/.test(ideaLower);
  const marketplaceBrands = /\b(upwork|fiverr|99designs|dribbble|behance|toptal|taskrabbit)\b/.test(ideaLower);
  // Artisan/handmade signals
  const kwArtisan = /\b(artisan|hand[- ]?made|handcrafted|small\s?batch|crafts?|pottery|ceramic|ceramics|jewel(?:ry|er)y|leather|woodwork|woodworking|knit|weav|quilt|soap|candle|candlemaking|embroidery|macrame|resin|metalwork|glass|blown\s?glass|loom|weaving)\b/i.test(ideaLower);
  const kwVintage = /\b(vintage|thrift|secondhand|resale)\b/i.test(ideaLower);
  const craftMarketplaceBrands = /\b(etsy|amazon\s*handmade|faire|big\s*cartel)\b/i.test(ideaLower);
  // Edtech learning/course marketplace signals
  const kwCourse = /\b(course|courses|class|classes|lesson|lessons|learning|tutorial|cohort|curriculum|bootcamp|module|lecture|skill|skills)\b/.test(ideaLower);
  const kwTeacherSide = /\b(instructor|instructors|teacher|teachers|tutor|tutors|creator|creators)\b/.test(ideaLower);
  const kwStudentSide = /\b(student|students|learner|learners|subscriber|subscribers|audience)\b/.test(ideaLower);
  const edtechBrands = /\b(udemy|skillshare|coursera|udacity|teachable|thinkific|kajabi|podia|domestika)\b/.test(ideaLower);

  // Primary marketplace signals
  const kwFreelance = /\b(freelance|freelancer|freelancers|independent|contract|contractor|contractors|gig|gigs)\b/.test(ideaLower);
  const kwPlatform = /\b(platform|site|app|portal|network|market)\b/.test(ideaLower);
  const kwBid = /\b(bid|bidding|bids|compete|competition|contest|contests)\b/.test(ideaLower);
  const kwCommission = /\b(commission|commission-based)\b/.test(ideaLower);
  const kwServices = /\b(service|services|professional|professionals|provider|providers)\b/.test(ideaLower);
  const kwConnectHire = /\b(connect|match|find|hire|book|client|clients)\b/.test(ideaLower);

  // Creative-specific signals
  const kwCreative = /\b(creative|creatives|designer|designers|design|graphic|logo|branding|illustration|illustrator|web design)\b/.test(ideaLower);

  // Detection logic per suggestion
  const looksLikeMarketplace = (
    (kwFreelance && (mentionsMarketplace || kwPlatform || kwServices)) ||
    (kwPlatform && kwBid) ||
    (kwCommission && kwServices) ||
    marketplaceBrands ||
    (mentionsMarketplace && (kwServices || kwFreelance))
  ) && (kwConnectHire || kwServices || kwFreelance || mentionsMarketplace);

  const isCreativeMarketplace = looksLikeMarketplace && kwCreative;
  const isGenericMarketplace = looksLikeMarketplace; // umbrella signal for all marketplaces
  const isEdtechMarketplace = ((kwCourse && (mentionsMarketplace || kwTeacherSide || edtechBrands)) && (kwStudentSide || mentionsMarketplace)) || (edtechBrands && kwCourse);
  const isCraftMarketplace = (kwArtisan || kwVintage) && (looksLikeMarketplace || craftMarketplaceBrands || mentionsMarketplace);
  const isHandmadeDTC = (kwArtisan || kwVintage) && !looksLikeMarketplace;
  const isRegulatedServices = /\b(legal|attorney|law|tax|accounting|cpa|compliance|audit|gdpr|hipaa|soc 2|iso 27001|aml|kyc|kyb)\b/i.test(ideaLower);
  // Email/comms (ESP/marketing automation/transactional) verticalization detection
  const isVerticalComms = (
    /\b(email|newsletter|smtp|campaign|deliverability|transactional|drip|automation|esp)\b/i.test(ideaLower)
    || /\b(mailchimp|sendgrid|postmark|mailgun|klaviyo|braze|customer ?io|customer\.io)\b/i.test(ideaLower)
  ) && !looksLikeMarketplace && !isProjectManagement && !isCustomerSupport;

  const marketCategory = isCoffeeSubscription
    ? 'DTC Subscription (Coffee)'
    : isProjectManagement
    ? 'Project Management Software'
    : isCustomerSupport
      ? 'Customer Support/Help Desk Software'
      : isCraftMarketplace
        ? 'Artisan Goods Marketplace'
      : isHandmadeDTC
        ? 'Handmade DTC Brand'
      : isEdtechMarketplace
        ? 'Learning/Course Marketplace'
      : isCreativeMarketplace
        ? 'Freelance Marketplace'
        : isGenericMarketplace
          ? 'Services/Talent Marketplace'
          : isRegulatedServices
            ? 'Regulated Services Platform'
            : isVerticalComms
              ? 'Vertical Communications (Email/Comms)'
            : (result?.business_dna?.subIndustry || result?.business_dna?.industry || 'General');

  // Centralized, category-specific pivot suggestions
  const pivotSuggestions: Record<string, string[]> = {
    'pm-software': [
      'Construction PM: Target ~$12B construction software gap',
      'Healthcare Workflows: HIPAA-compliant project tracking',
      'Legal Case Management: Combines PM + compliance requirements',
      'Field Service Operations: Mobile-first PM for technicians'
    ],
    'learning-marketplace': [
      'Seed supply: onboard 5–10 top instructors in one niche (e.g., AI design for marketers) with revenue share guarantees',
      'Cohort-first: run 1–2 live/cohort courses to drive completion and testimonials before scaling self-serve',
      'Credential moat: verified certificates, projects, and outcomes to reduce price competition and disintermediation',
      'Demand beachhead: partner with 2–3 micro-communities (Discord/Slack/newsletters) to acquire first 200 learners efficiently'
    ],
    'freelance-marketplace': [
      'Niche + Geo examples: Launch a Miami-based packaging designer collective for D2C beverage founders; Target UX writers for healthtech startups in SF/Boston',
      'Managed Workflows: escrow, structured briefs, QA reviews, and concierge onboarding (e.g., “99designs for medical illustrators” with white-glove onboarding) reduce disintermediation and increase trust',
      'Regulated Services: legal/accounting/consulting with compliance checks, secure document handling, and SLA-backed guarantees',
      'Geo Focus: dominate a city/region first to reach liquidity (meetups, local partnerships, seed both sides)'
    ],
    'services-marketplace': [
      'Narrow ICP: one service + one industry + geo (e.g., SOC 2 auditors for SaaS startups in Austin)',
      'Managed/Assured: SLAs, milestone QA, dispute resolution, concierge onboarding; reduces leakage by aligning incentives',
      'Compliance & Escrow: contracts, identity/KYB, secure data rooms, and staged payments to increase retention',
      'Local Beachhead: win a city/region first (offline events, channel partners, early adopter incentives)'
    ],
    'regulated-services': [
      'Legal/accounting/compliance: add secure document handling, audit trails, and signed guarantees',
      'Offer compliance reviews with standardized checklists and professional indemnity coverage',
      'Integrate KYB/KYC/AML where needed; provide escrow with milestone-based release',
      'Start with one regulated vertical and city; run 5–10 guided engagements to refine process'
    ],
    'vertical-comms': [
      'Verticalize: pick one industry (e.g., clinics, property managers, law firms) and build integrations they cannot get from generic ESPs',
      'Wedge Strategy: start with one painful workflow (e.g., HIPAA-compliant receipts for dental offices, security alerts for property managers)',
      'Bundle Services: software + done-for-you onboarding, analytics/reporting, and regulatory help (e.g., BAAs, audit logs)',
      'Demand Validation: run a landing page for the single vertical/workflow; aim for 25 signups in 2 weeks with demo or paid pilot offers',
      'Differentiate & GTM: ship a killer feature (compliance automation, one-click reporting, or EHR/CRM integration) and go via meetups/trade groups'
    ],
    'customer-support': [
      'Industry Specialization: Healthcare, fintech, or logistics workflows',
      'Migration & ROI: Fast imports and measurable gains (deflection, time-to-first-response)',
      'In-Product Support: Proactive guidance and embedded help to reduce tickets'
    ],
    'ecommerce': [
      'Defensible Niche: Regulated, hard-to-ship, or expertise-heavy categories',
      'Ops Advantage: Superior logistics, bundling, or private label differentiation',
      'Retention Mechanics: Subscriptions, community, or exclusive drops',
      'Efficient Acquisition: SEO/UGC/affiliates to reduce paid CAC dependency'
    ],
    'generic-saturated': [
      'Verticalization: Solve deeply for one industry with integrations',
      'Wedge Strategy: Start with one painful workflow then expand',
      'Bundled Value: Combine software + services to boost differentiation'
    ],
    'general': [
      'Clarify your ICP and their top 3 pains',
      'Run 5–7 interviews to validate desired outcomes',
      'Launch a simple waitlist + smoke test for early demand',
      'Secure 1–2 paid pilot commitments to validate WTP'
    ]
  };

  // detectedCategoryKey will be computed after saturationOut is set

  const majorCompetitors = isCoffeeSubscription
    ? [
        { name: 'Trade Coffee', valuation: '$50M+', marketShare: '8%' },
        { name: 'Blue Bottle', valuation: '$700M', marketShare: '12%' },
        { name: 'Mistobox', valuation: '$10M+', marketShare: '3%' },
        { name: 'Atlas Coffee Club', valuation: '$25M+', marketShare: '5%' }
      ]
    : isCraftMarketplace
    ? [
        { name: 'Etsy', valuation: '$8.2B', marketShare: '45%' },
        { name: 'Amazon Handmade', valuation: 'Part of $1.7T', marketShare: '25%' },
        { name: 'Faire', valuation: '$12.4B', marketShare: '8%' },
        { name: 'Shopify', valuation: '$65B', marketShare: '15%' }
      ]
    : isHandmadeDTC
    ? [
        { name: 'Etsy top shops', valuation: 'Various', marketShare: '40%' },
        { name: 'Shopify indie brands', valuation: 'Various', marketShare: '30%' },
        { name: 'Instagram Shops', valuation: 'Part of $800B', marketShare: '20%' },
        { name: 'Amazon Handmade', valuation: 'Part of $1.7T', marketShare: '10%' }
      ]
    : isProjectManagement
    ? [
        { name: 'Atlassian/Jira', valuation: '$50B', marketShare: '35%' },
        { name: 'Monday.com', valuation: '$8-10B', marketShare: '15%' },
        { name: 'Notion', valuation: '$10B', marketShare: '12%' },
        { name: 'Asana', valuation: '$2-5B', marketShare: '18%' }
      ]
    : isCustomerSupport
      ? [
          { name: 'Zendesk', valuation: '$13.8B', marketShare: '28%' },
          { name: 'Freshdesk', valuation: '$13B', marketShare: '18%' },
          { name: 'Intercom', valuation: '$1.3B', marketShare: '12%' },
          { name: 'Help Scout', valuation: '$100M+', marketShare: '8%' }
        ]
      : isEdtechMarketplace
        ? [
            { name: 'Udemy', valuation: '$6.5B', marketShare: '22%' },
            { name: 'Skillshare', valuation: '$500M+', marketShare: '15%' },
            { name: 'Coursera', valuation: '$7B', marketShare: '25%' },
            { name: 'Teachable', valuation: '$4B', marketShare: '12%' }
          ]
      : isCreativeMarketplace
        ? [
            { name: 'Upwork', valuation: '$1.5B', marketShare: '35%' },
            { name: 'Fiverr', valuation: '$1.2B', marketShare: '25%' },
            { name: '99designs', valuation: '$100M+', marketShare: '8%' },
            { name: 'Dribbble', valuation: '$50M+', marketShare: '5%' }
          ]
        : isGenericMarketplace
          ? [
              { name: 'Upwork', valuation: '$1.5B', marketShare: '30%' },
              { name: 'Fiverr', valuation: '$1.2B', marketShare: '25%' },
              { name: 'Toptal', valuation: '$200M+', marketShare: '8%' },
              { name: 'TaskRabbit', valuation: '$100M+', marketShare: '5%' }
            ]
          : isVerticalComms
            ? [
                { name: 'Mailchimp', valuation: '$12B', marketShare: '30%' },
                { name: 'SendGrid', valuation: '$3B', marketShare: '20%' },
                { name: 'Klaviyo', valuation: '$9.15B', marketShare: '15%' },
                { name: 'Braze', valuation: '$2.5B', marketShare: '10%' }
              ]
          : [
              { name: 'Market Leader A', valuation: 'Undisclosed', marketShare: '25%' },
              { name: 'Market Leader B', valuation: 'Undisclosed', marketShare: '20%' },
              { name: 'Market Leader C', valuation: 'Undisclosed', marketShare: '15%' }
            ];

  let avgCACRange: [number, number] | undefined = isCoffeeSubscription
    ? [60, 180] // typical blended DTC CAC band
    : isCraftMarketplace
    ? [400, 900]
    : isHandmadeDTC
    ? [150, 400]
    : isProjectManagement
    ? [400, 800]
    : isCustomerSupport
      ? [630, 1170] // around typical 900 ±30%
      : isEdtechMarketplace
        ? [600, 1200]
      : isCreativeMarketplace
        ? [600, 1200]
        : isGenericMarketplace
          ? [700, 1300]
          : isVerticalComms
            ? [500, 1000]
          : undefined;

  const economicsExplanation = isCoffeeSubscription
    ? 'Economics driven by COGS per box, shipping, and churn; aim for 50–65% gross margin and <6 month payback'
    : isCraftMarketplace
    ? 'Two‑sided craft marketplaces compete with Etsy and Instagram Shops; liquidity and trust are critical. Monetization via take‑rate; CAC can be high without a unique niche or geo focus.'
    : isHandmadeDTC
    ? 'Handmade DTC brands face production capacity and QC constraints. Margins hinge on materials + labor + shipping; seasonality (gifting) impacts cashflow. Aim for ≥60% gross margin and short lead times.'
    : isProjectManagement
    ? 'New entrants face ~3x higher CAC with commodity pricing and strong incumbent brand preference'
    : isCustomerSupport
      ? 'Help desk/support tools are mature with deep integrations; displacement requires strong ROI and switching incentives'
      : isEdtechMarketplace
        ? 'Two-sided course marketplaces depend on quality supply, completion/engagement, and GMV × take‑rate; manage refunds and disintermediation'
      : isCreativeMarketplace
        ? 'Two-sided marketplaces in saturated verticals face high acquisition costs and platform lock-in'
        : isGenericMarketplace
          ? 'Two-sided services marketplaces face high CACs, disintermediation risk, and entrenched brands'
          : isVerticalComms
            ? 'Generic ESPs are entrenched; to win you need vertical workflows, compliance automation (e.g., HIPAA/BAA), and clear ROI in one niche'
          : (baseEconomicsScore <= 2 ? 'New entrants face elevated CAC relative to LTV; pricing power limited' : undefined);

  // For PM and generic/freelance marketplaces, treat saturation as very high
  let saturationOut = isCoffeeSubscription
    ? saturationPct // don’t force saturation; use computed underserved signal
    : isCraftMarketplace
    ? 88
    : isProjectManagement
    ? 95
    : isCustomerSupport
      ? 92
      : isEdtechMarketplace
        ? 90
      : isCreativeMarketplace
        ? 90 // Enforce 90% to align caps with PM treatment
        : isGenericMarketplace
          ? 92 // 90–95% band for generic talent/services marketplaces
          : isVerticalComms
            ? 90 // Generic ESPs are saturated; require vertical wedge
          : saturationPct;
  // Flags used to annotate applied adjustments
  const flags: string[] = [];
  if (isPhysicalSubscription) flags.push('PHYSICAL_SUBSCRIPTION');
  if (isCoffeeSubscription) flags.push('COFFEE_SUBSCRIPTION');
  if (isCraftMarketplace || isHandmadeDTC) flags.push('ARTISAN_CRAFT');
  if (isCraftMarketplace) flags.push('CRAFT_MARKETPLACE');
  if (isHandmadeDTC) flags.push('HANDMADE_DTC');
  if (isEdtechMarketplace) { flags.push('EDTECH_MARKETPLACE'); flags.push('MARKETPLACE_CATEGORY'); }

  // Fallback to saturation DB when ambiguous: if not PM and not clearly a marketplace but DB says saturated
  if (!isProjectManagement && !isGenericMarketplace) {
    const sat = assessMarketSaturation ? assessMarketSaturation(fullIdeaText || '') : undefined as any;
    if (sat && sat.penalty && sat.saturation >= 80) {
      saturationOut = Math.max(saturationOut, Math.min(100, sat.saturation));
      if (sat.competitors && sat.competitors.length && majorCompetitors.length === 0) {
        // Convert string competitors from saturation DB to structured format
        sat.competitors.forEach((comp: string) => {
          (majorCompetitors as Array<{name: string; valuation: string; marketShare: string}>).push({
            name: comp,
            valuation: 'Undisclosed',
            marketShare: 'Unknown'
          });
        });
      }
      if (!avgCACRange && typeof sat.recommendedCAC === 'number' && sat.recommendedCAC > 0) {
        avgCACRange = [Math.round(sat.recommendedCAC * 0.7), Math.round(sat.recommendedCAC * 1.3)];
      }
      flags.push('SATURATION_DB_MATCH');
    }
  }

  // Track granular adjustments for transparency
  const adjustments: Array<{
    dimension: 'problem' | 'demand' | 'economics' | 'overall';
    kind: 'cap' | 'floor';
    reason: string;
  benchmark?: Record<string, unknown>;
    before10?: number;
    after10?: number;
    before100?: number;
    after100?: number;
  }> = [];
  // Clamp demand & economics in saturated categories to keep alignment
  const demandCap10 = (saturationOut >= 95 || isProjectManagement || isGenericMarketplace || isEdtechMarketplace) ? 3.5 : (saturationOut >= 90 ? 4.0 : null);
  const econCap10 = (saturationOut >= 95 || isProjectManagement || isGenericMarketplace || isEdtechMarketplace) ? 3.0 : (saturationOut >= 90 ? 4.0 : null);
  let demandScore = demandCap10 !== null ? Math.min(baseDemandScore, demandCap10) : baseDemandScore;
  if (demandScore < baseDemandScore && demandCap10 !== null) {
    adjustments.push({
      dimension: 'demand',
      kind: 'cap',
      reason: 'Market saturation clamp',
      benchmark: { saturationPct: saturationOut, capMax10: demandCap10 },
      before10: Number(baseDemandScore),
      after10: Number(demandScore)
    });
  }
  // Decide economics path: SaaS-style vs physical subscription
  let economicsScore = econCap10 !== null ? Math.min(baseEconomicsScore, econCap10) : baseEconomicsScore;
  let physicalEcon: any | null = null;
  let economicsOverride10: number | null = null;
  if (isPhysicalSubscription) {
    const priceNum = typeof hybridInput.price_point === 'number' && hybridInput.price_point > 0
      ? Number(hybridInput.price_point)
      : (() => { const m = (fullIdeaText || '').match(/\$\s*([0-9]+(?:\.[0-9]+)?)/i); return m ? parseFloat(m[1]) : 25; })();
    const bodies = additionalFields || {};
    const boxesPerMonth = Number.isFinite(bodies.boxes_per_month) ? Number(bodies.boxes_per_month) : 1;
    const churnRate = Number.isFinite(bodies.churn_rate) ? Number(bodies.churn_rate) : undefined;
    const marketCAC = Number.isFinite(bodies.cac) ? Number(bodies.cac) : (avgCACRange ? Math.round((avgCACRange[0]+avgCACRange[1])/2) : undefined);
    physicalEcon = FinancialValidator ? FinancialValidator.calculatePhysicalSubscriptionEconomics(
      priceNum,
      {
        beansCost: Number.isFinite(bodies.cogs_beans) ? Number(bodies.cogs_beans) : undefined,
        packagingCost: Number.isFinite(bodies.cogs_packaging) ? Number(bodies.cogs_packaging) : undefined,
        fulfillmentCost: Number.isFinite(bodies.cogs_fulfillment) ? Number(bodies.cogs_fulfillment) : undefined,
        shippingCost: Number.isFinite(bodies.cogs_shipping) ? Number(bodies.cogs_shipping) : undefined,
        otherCost: Number.isFinite(bodies.cogs_other) ? Number(bodies.cogs_other) : undefined,
        breakageAllowancePct: Number.isFinite(bodies.breakage_pct) ? Number(bodies.breakage_pct) : undefined,
      },
      { boxesPerMonth, churnRate, marketCAC }
    ) : null;
    // Map physical economics to a 0–10 score emphasizing margin and payback
  const marginComponent = physicalEcon ? Math.max(0, Math.min(1, (physicalEcon.grossMarginPct - 0.35) / 0.35)) : 0;
  const paybackComponent = physicalEcon ? Math.max(0, Math.min(1, (6 - (Number.isFinite(physicalEcon.paybackMonths) ? Number(physicalEcon.paybackMonths) : 12)) / 6)) : 0;
    economicsOverride10 = Number(((marginComponent * 0.6 + paybackComponent * 0.4) * 10).toFixed(1));
    economicsScore = economicsOverride10;
    flags.push('ECONOMICS_PHYSICAL_MODEL');
  }
  if (!isPhysicalSubscription && economicsScore < baseEconomicsScore && econCap10 !== null) {
    adjustments.push({
      dimension: 'economics',
      kind: 'cap',
      reason: 'Market saturation clamp',
      benchmark: { saturationPct: saturationOut, capMax10: econCap10 },
      before10: Number(baseEconomicsScore),
      after10: Number(economicsScore)
    });
  }
  // Additional calibration: for generic PM at low price point (<= $29/mo), further cap economics to 2.5/10
  if (!isPhysicalSubscription && isProjectManagement) {
    let statedPrice: number | undefined = undefined;
    if (typeof hybridInput.price_point === 'number' && !Number.isNaN(hybridInput.price_point)) {
      statedPrice = Number(hybridInput.price_point);
    } else {
      // Simple $<number> extraction (e.g., "$29", "$29/mo")
      const m = (fullIdeaText || '').match(/\$\s*([0-9]+(?:\.[0-9]+)?)/i);
      if (m) {
        statedPrice = parseFloat(m[1]);
      }
    }
    if (typeof statedPrice === 'number' && statedPrice <= 29) {
      if (economicsScore > 2.5) {
        const before = economicsScore;
        economicsScore = 2.5;
        flags.push('ECONOMICS_PRICE_CAP_APPLIED');
        adjustments.push({
          dimension: 'economics',
          kind: 'cap',
          reason: 'Price <= $29 in PM software',
          benchmark: { priceThresholdUSD: 29 },
          before10: Number(before),
          after10: Number(economicsScore)
        });
      }
    }
  }
  // Cross-category ratio-based cap using LTV/CAC when available (conservative months in saturated markets)
  let econRatio: number | null = null;
  let econCap10FromRatio: number | null = null;
  if (!isPhysicalSubscription) {
    const hybridAny = hybridInput as unknown as Record<string, unknown>;
    let effectiveCAC: number | undefined = (typeof hybridAny.cac_estimate === 'number' && (hybridAny.cac_estimate as number) > 0)
      ? Number(hybridAny.cac_estimate as number)
      : undefined;
    if (!effectiveCAC && avgCACRange) {
      effectiveCAC = Math.round((avgCACRange[0] + avgCACRange[1]) / 2);
    }
    let priceNum: number | undefined = typeof hybridInput.price_point === 'number' ? Number(hybridInput.price_point) : undefined;
    if (priceNum === undefined) {
      const m2 = (fullIdeaText || '').match(/\$\s*([0-9]+(?:\.[0-9]+)?)/i);
      if (m2) priceNum = parseFloat(m2[1]);
    }
    let ltvNum: number | undefined = (typeof hybridAny.ltv_estimate === 'number' && (hybridAny.ltv_estimate as number) > 0)
      ? Number(hybridAny.ltv_estimate as number)
      : undefined;
    if (!ltvNum && typeof priceNum === 'number') {
      const months = (saturationOut >= 85 || isProjectManagement) ? 12 : 18;
      ltvNum = priceNum * months;
    }
    if (effectiveCAC && ltvNum) {
      econRatio = ltvNum / effectiveCAC;
      econCap10FromRatio = Math.max(0, Math.min(10, Number((econRatio * 4).toFixed(2))));
      if (economicsScore > econCap10FromRatio) {
        const before = economicsScore;
        economicsScore = econCap10FromRatio;
        flags.push('ECONOMICS_RATIO_CAP_APPLIED');
        adjustments.push({
          dimension: 'economics',
          kind: 'cap',
          reason: 'LTV:CAC ratio cap',
          benchmark: { ltvCac: Number(econRatio.toFixed(2)), cap10: econCap10FromRatio },
          before10: Number(before),
          after10: Number(economicsScore)
        });
      }
    }
  }
  if (isProjectManagement) flags.push('PM_CATEGORY');
  if (isCustomerSupport) flags.push('CUSTOMER_SUPPORT_CATEGORY');
  if (isGenericMarketplace) flags.push('MARKETPLACE_CATEGORY');
  if (isCreativeMarketplace) flags.push('CREATIVE_MARKETPLACE');
  if (saturationOut >= 90) flags.push('SATURATION_CLAMPS_APPLIED');

  // Normalize detection to a map key (now that saturationOut is known)
  const detectedCategoryKey = isProjectManagement
    ? 'pm-software'
    : isEdtechMarketplace
      ? 'learning-marketplace'
    : isCreativeMarketplace
      ? 'freelance-marketplace'
      : isGenericMarketplace
        ? 'services-marketplace'
        : isCustomerSupport
          ? 'customer-support'
          : isRegulatedServices
            ? 'regulated-services'
            : isVerticalComms
              ? 'vertical-comms'
            : (saturationOut >= 85 ? 'generic-saturated' : 'general');

  // Build per-dimension explanations ("why" behind scores)
  const why: Record<string, string> = {};
  if (isProjectManagement) {
    why.problem = 'Problem is real but broadly solved by established PM tools; little whitespace at generic level';
  } else if (isGenericMarketplace || isEdtechMarketplace) {
    why.problem = 'Crowded marketplace category with dominant platforms; unmet need is low at generic level';
  } else if (saturationOut >= 85) {
    why.problem = 'High saturation suggests limited unmet need in this category';
  }
  if (demandScore < 5) {
    why.demand_signals = 'Few early signals (no interviews/waitlist/LOIs provided); unclear ICP and value proof';
  } else {
    why.demand_signals = 'Some positive indicators, but more customer validation would increase confidence';
  }
  if (moatScore < 5) {
    why.differentiation = isProjectManagement
      ? 'Generic features (kanban/Slack integration) are ubiquitous; no defensible wedge identified'
      : isGenericMarketplace
        ? 'Generic marketplace features are commodity; no defensible wedge or network effect identified'
        : 'Limited defensibility; differentiation not yet compelling or validated';
  } else {
    why.differentiation = 'Clearer differentiation signals present; validate defensibility with target users';
  }
  if (economicsScore <= 4) {
    why.wtp = economicsExplanation || 'Unit economics look weak without strong pricing power or low-CAC channels';
  } else {
    why.wtp = 'Willingness to pay appears reasonable; validate price–value fit with paid pilots';
  }
  if (isPhysicalSubscription && physicalEcon) {
    why.wtp = `COGS- and shipping-based economics used. Gross margin ${(physicalEcon.grossMarginPct*100).toFixed(0)}%, CAC payback ${Number(physicalEcon.paybackMonths).toFixed(1)} mo.`;
  }
  if (flags.includes('ECONOMICS_PRICE_CAP_APPLIED')) {
    why.wtp = 'Commodity price point vs expected CAC suggests weak payback; economics capped for realism';
  }
  if (distributionScore <= 5) {
    why.gtm = 'Acquisition path unclear; competing against entrenched brands may push CAC higher';
  } else {
    why.gtm = 'Some channels identified; model CAC/LTV to ensure viable payback';
  }
  // Compute Problem (0–100) from hybrid problem score (0–10) with small floor in saturated markets
  let problemPct = Math.round((typeof result.scores.problem === 'number' ? result.scores.problem : demandScore) * 10);
  const problemPctOriginal = problemPct;
  // If market is highly saturated, reflect that problem exists but is solved (avoid hard zero)
  if (isProjectManagement) {
    if (problemPct === 0) problemPct = 2; // 2/100 to indicate solved problem, not absence
  } else if (isGenericMarketplace) {
    if (problemPct === 0) problemPct = 2;
  } else if (saturationPct >= 90 && problemPct === 0) {
    problemPct = 2;
  } else if (saturationPct >= 80 && problemPct === 0) {
    problemPct = 1;
  }

  // In saturated markets, cap displayed Problem to avoid contradictions with very low underserved
  // - PM generic or saturation >=95%: 10–20/100
  // - saturation 90–94%: <= 25/100
  // - saturation 85–89%: <= 35/100
  if (saturationOut >= 95 || isProjectManagement) {
    const baseTarget = 10;
    const softBump = Math.round(((moatScore + demandScore) / 2));
    const cap = Math.min(18, baseTarget + Math.floor(softBump / 4));
    const before = problemPct;
    problemPct = Math.min(problemPct, cap);
    if (problemPct < before) {
      adjustments.push({
        dimension: 'problem',
        kind: 'cap',
        reason: 'PM/saturated category problem cap',
        benchmark: { saturationPct: saturationOut, capMax100: cap },
        before100: Number(before),
        after100: Number(problemPct)
      });
    }
  } else if ((isGenericMarketplace || isEdtechMarketplace) && saturationOut >= 90) {
    const baseTarget = 10; // align with PM treatment for very saturated marketplaces
    const softBump = Math.round(((moatScore + demandScore) / 2));
    const cap = Math.min(18, baseTarget + Math.floor(softBump / 4));
    const before = problemPct;
    problemPct = Math.min(problemPct, cap);
    if (problemPct < before) {
      adjustments.push({
        dimension: 'problem',
        kind: 'cap',
        reason: 'Marketplace saturated problem cap',
        benchmark: { saturationPct: saturationOut, capMax100: cap },
        before100: Number(before),
        after100: Number(problemPct)
      });
    }
  } else if ((isGenericMarketplace || isEdtechMarketplace) && saturationOut >= 85) {
    const baseTarget = 12; // slightly higher than PM for lower saturation band
    const softBump = Math.round(((moatScore + demandScore) / 2));
    const cap = Math.min(20, baseTarget + Math.floor(softBump / 4));
    const before = problemPct;
    problemPct = Math.min(problemPct, cap);
    if (problemPct < before) {
      adjustments.push({
        dimension: 'problem',
        kind: 'cap',
        reason: 'Marketplace high-saturation problem cap',
        benchmark: { saturationPct: saturationOut, capMax100: cap },
        before100: Number(before),
        after100: Number(problemPct)
      });
    }
  } else if (saturationOut >= 90) {
    const before = problemPct;
    problemPct = Math.min(problemPct, 25);
    if (problemPct < before) {
      adjustments.push({
        dimension: 'problem',
        kind: 'cap',
        reason: 'High saturation problem cap',
        benchmark: { saturationPct: saturationOut, capMax100: 25 },
        before100: Number(before),
        after100: Number(problemPct)
      });
    }
  } else if (saturationOut >= 85) {
    const before = problemPct;
    problemPct = Math.min(problemPct, 35);
    if (problemPct < before) {
      adjustments.push({
        dimension: 'problem',
        kind: 'cap',
        reason: 'Elevated saturation problem cap',
        benchmark: { saturationPct: saturationOut, capMax100: 35 },
        before100: Number(before),
        after100: Number(problemPct)
      });
    }
  }
  // Unified /10 problem for output
  const problemScore10 = Number((problemPct / 10).toFixed(1));

  // Build constructive guidance based on context from centralized map
  const guidance: string[] = [];
  const baseSuggestions = pivotSuggestions[detectedCategoryKey] || [];
  guidance.push(...baseSuggestions);

  // Compute underserved percent (0–100) now for severe-low checks, and /10 for scoring
  const underservedPct = Math.max(0, Math.min(100, Math.round(100 - saturationOut)));
  const underserved10 = Number((underservedPct / 10).toFixed(1));

  // Correlate demand with problem when the market isn't fully saturated
  // - If saturation < 90, raise a proportional floor: demand >= problem * 0.25 (/10 scale) up to underserved and clamps
  // - If saturation >= 90, apply only minimal floor to avoid contradictions but respect saturation constraints
  let demandFloorApplied = false;
  if (Number.isFinite(demandScore)) {
    const prob = Number(problemScore10); // 0..10
    const maxClamp = (saturationOut >= 95 || isProjectManagement || isGenericMarketplace) ? 3.5 : (saturationOut >= 90 ? 4.0 : 10);
    if (saturationOut < 90) {
      // Proportional floor: 25% of problem score (e.g., problem 8 -> demand floor 2)
      const proportionalFloor = Math.max(0, Number((prob * 0.25).toFixed(2)));
      const boundedFloor = Math.min(proportionalFloor, underserved10, maxClamp);
      if (demandScore < boundedFloor) {
        const before = demandScore;
        demandScore = boundedFloor;
        demandFloorApplied = true;
        flags.push('DEMAND_CORRELATED_WITH_PROBLEM');
        adjustments.push({
          dimension: 'demand',
          kind: 'floor',
          reason: 'Correlated with problem evidence',
          benchmark: { proportionalFloor10: proportionalFloor },
          before10: Number(before),
          after10: Number(demandScore)
        });
      }
    } else {
      // Highly saturated: retain conservative minimal floors to remove hard contradictions
      if (prob >= 6 && demandScore < 1) {
        const before = demandScore;
        demandScore = Math.min(1.5, underserved10, maxClamp);
        demandFloorApplied = true;
        flags.push('DEMAND_FLOOR_FROM_PROBLEM');
        adjustments.push({
          dimension: 'demand',
          kind: 'floor',
          reason: 'Remove contradiction at high problem in saturated market',
          benchmark: { saturationPct: saturationOut, floor10: 1.5 },
          before10: Number(before),
          after10: Number(demandScore)
        });
      } else if (prob >= 4 && demandScore < 0.5) {
        const before = demandScore;
        demandScore = Math.min(1.0, underserved10, maxClamp);
        demandFloorApplied = true;
        flags.push('DEMAND_FLOOR_FROM_PROBLEM');
        adjustments.push({
          dimension: 'demand',
          kind: 'floor',
          reason: 'Remove contradiction at moderate problem in saturated market',
          benchmark: { saturationPct: saturationOut, floor10: 1.0 },
          before10: Number(before),
          after10: Number(demandScore)
        });
      }
    }
  }
  if (demandFloorApplied) {
    // Refresh the demand explanation to avoid contradiction and to surface next steps
    if (saturationOut >= 90) {
      why.demand_signals = 'Some user pain exists, but demand is constrained by a saturated/solved market; validate with targeted interviews and a small waitlist test';
    } else {
      why.demand_signals = 'Problem evidence suggests corresponding demand; run 5–7 interviews and a waitlist smoke test to quantify interest';
    }
  }

  // Determine overall from visible dimension scores for mathematical consistency
  // Weights (sum=1): problem 0.20, underserved 0.15, demand 0.20, differentiation 0.15, economics 0.20, gtm 0.10
  const weightProblem = 0.20;
  const weightUnderserved = 0.15;
  const weightDemand = 0.20;
  const weightMoat = 0.15;
  const weightEconomics = 0.20;
  const weightGtm = 0.10;
  const contribProblem = Number(problemScore10) * weightProblem;
  const contribUnderserved = Number(underserved10) * weightUnderserved;
  const contribDemand = Number(demandScore) * weightDemand;
  const contribMoat = Number(moatScore) * weightMoat;
  const contribEconomics = Number(economicsScore) * weightEconomics;
  const contribGtm = Number(distributionScore) * weightGtm;
  const overall10 = (contribProblem + contribUnderserved + contribDemand + contribMoat + contribEconomics + contribGtm);
  let overallPercent = Math.round(overall10 * 10);
  // Market reality caps: if problem and underserved are extremely low, cap overall to avoid optimism
  let marketRealityCap: 15 | 25 | null = null;
  if (problemScore10 <= 1 && underserved10 <= 1) {
    overallPercent = Math.min(overallPercent, 15);
    marketRealityCap = 15;
    flags.push('CAPPED_BY_PROBLEM_UNDERSERVED_15');
  } else if (problemScore10 <= 2 && underserved10 <= 2) {
    overallPercent = Math.min(overallPercent, 25);
    marketRealityCap = 25;
    flags.push('CAPPED_BY_PROBLEM_UNDERSERVED_25');
  }
  // Consistent saturated-category cap: apply to any market with saturation >= 90
  if (saturationOut >= 90) {
    const prev = overallPercent;
    overallPercent = Math.min(overallPercent, 15);
    if (overallPercent < prev) {
      flags.push('CAPPED_BY_SATURATED_CATEGORY_15');
      adjustments.push({
        dimension: 'overall',
        kind: 'cap',
        reason: 'Saturated category overall cap',
        benchmark: { saturationPct: saturationOut, capMax100: 15 },
        before100: Number(prev),
        after100: Number(overallPercent)
      });
    }
  }
  // Map to status with unified thresholds: GO >=70, REVIEW 40-69, else NO-GO
  let status: 'GO' | 'REVIEW' | 'NO-GO' = (overallPercent >= 70 ? 'GO' : overallPercent >= 40 ? 'REVIEW' : 'NO-GO');

  // If it's a REVIEW with effectively no demand evidence, inject concrete next steps
  if (status === 'REVIEW' && Number(demandScore) <= 1) {
    guidance.push(
      'Book 5–7 interviews with your ICP to validate top pains and desired outcomes',
      'Ship a one-page landing + waitlist; drive ~50 targeted visits via 2 channels and target 10–20 signups',
      'Secure 1–2 paid pilot commitments at your target price; measure week-1 activation'
    );
  }

  // Severe-low guardrail: if signals show effectively no problem, no demand, fully served market,
  // and poor economics, force NO-GO with strong pivot guidance regardless of blended score.
  // Prefer raw hybrid metrics if available, else use derived values
  const rawProblem10 = typeof result.scores.problem === 'number' ? Number(result.scores.problem) : null;
  const rawUnderserved10 = typeof result.scores.underserved === 'number' ? Number(result.scores.underserved) : underserved10;
  const rawDemand10 = typeof result.scores.demand_signals === 'number' ? Number(result.scores.demand_signals) : null;
  const rawWtp10 = typeof result.scores.willingness_to_pay === 'number' ? Number(result.scores.willingness_to_pay) : null;

  const badProblem = ((rawProblem10 !== null ? rawProblem10 * 10 : problemPct) <= 5);
  const badUnderserved = ((rawUnderserved10 !== null ? rawUnderserved10 * 10 : underservedPct) <= 5);
  const badDemand = ((rawDemand10 !== null ? rawDemand10 : Number(demandScore)) <= 1);
  const badEconomics = ((rawWtp10 !== null ? rawWtp10 : Number(economicsScore)) <= 3.5);
  const extremeLowCount = [badProblem, badUnderserved, badDemand, badEconomics].filter(Boolean).length;
  const severeLow = extremeLowCount >= 3;
  if (severeLow || overallPercent <= 10) {
    status = 'NO-GO';
    // Clamp overall to a clearly low bucket to avoid contradictory UI (e.g., 50% with NO-GO)
    overallPercent = Math.min(overallPercent, 10);
    flags.push('SEVERE_LOW_GUARD');
    // Ensure guidance contains a strong pivot recommendation and fundamental rethink
    guidance.unshift('Consider a fundamentally different approach or target market');
  }
  // Output overall as 0–100 to match UI expectations
  const overallScore100 = Math.round(overallPercent);

  // Benchmark gap analysis (requested mapping)
  const gapAnalysis = overallScore100 < 50
    ? 'Significantly below successful validation threshold'
    : overallScore100 < 65
      ? 'Below typical success range - needs improvement'
      : 'Within successful validation range';

  // Add explicit guidance for very low scores to prevent optimistic messaging
  if (overallPercent < 15) {
    guidance.unshift('Consider a fundamentally different approach or target market');
  }
  // Dedupe guidance to avoid repeated lines
  const seenGuidance = new Set<string>();
  const guidanceDeduped: string[] = [];
  for (const g of guidance) {
    if (!seenGuidance.has(g)) {
      guidanceDeduped.push(g);
      seenGuidance.add(g);
    }
  }

  // Clamp market_quality in saturated categories (keep /10 scale)
  const marketQualityBase = typeof result.scores.market_quality === 'number'
    ? Number(result.scores.market_quality)
    : Number(demandScore);
  const marketQualityClamped = (saturationOut >= 95 || isProjectManagement)
    ? Math.min(marketQualityBase, 3.5)
    : (saturationOut >= 90 ? Math.min(marketQualityBase, 4.5) : marketQualityBase);

  // Assign a stable id and timestamp for persistence/lookup
  const genId = (): string => {
    try {
      if (typeof nodeRandomUUID === 'function') return nodeRandomUUID();
    } catch {}
    return Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2);
  };
  const responseId = genId();
  const nowISO = new Date().toISOString();

  const response = {
      id: responseId,
      status,
      title: title || 'Business Idea',
      target_market: target_market || 'General Market',
      // Persist a normalized businessModel classification so results page can render it later
      businessModel: (() => {
        try {
          const raw = String(((result as unknown as { business_dna?: { businessModel?: string } }).business_dna?.businessModel) || '') || undefined;
          // Map raw DNA / inferred flags into a primaryType label consistent with pivot component expectations
          const primaryType = raw || (
            isGenericMarketplace || isEdtechMarketplace || isCreativeMarketplace || isCraftMarketplace
              ? 'MARKETPLACE'
              : (isCoffeeSubscription || isPhysicalSubscription)
                ? 'PHYSICAL_SUBSCRIPTION'
                : (isHandmadeDTC ? 'DTC_ECOM' : (isProjectManagement || isCustomerSupport || isVerticalComms ? 'SAAS_B2B' : 'GENERAL'))
          );
          // Heuristic confidence: higher when strong categorical signals present
          const confidence = (
            raw ? 0.9 : (
              (isGenericMarketplace || isEdtechMarketplace || isCreativeMarketplace || isCraftMarketplace) ? 0.8 : (
                (isCoffeeSubscription || isPhysicalSubscription) ? 0.85 : (
                  (isProjectManagement || isCustomerSupport || isVerticalComms) ? 0.75 : 0.6
                )
              )
            )
          );
          return { primaryType, confidence };
        } catch { return undefined; }
      })(),
      value_prop: (isProjectManagement
        ? 'Generic PM software faces significant market challenges in an oversaturated space'
        : (status === 'GO'
            ? 'Promising opportunity with solid early signals'
            : status === 'REVIEW'
              ? 'Moderate potential. Consider a pivot or niche.'
              : 'Significant market challenges. Strong pivot recommended.')),
      highlights: status === 'GO' ? [
        `Strong economics with ${Math.round(economicsScore * 10)}/100 score`,
        `Good differentiation with ${Math.round(moatScore * 10)}/100 moat`
      ] : [],
      risks: status !== 'GO' ? (
        risks.concat(
          isCoffeeSubscription ? [
            'Perishable inventory and freshness constraints (roast-to-ship SLAs)',
            'Shipping cost volatility and zone-based margin compression',
            'Seasonal demand swings (Q4 spikes, summer slumps) impact inventory planning',
            'Churn risk without variety, curation, and personalization'
          ] : isPhysicalSubscription ? [
            'Inventory holding risk and demand forecasting errors',
            'Shipping and packaging breakage/returns impact margins',
            'Seasonality requires buffer stock and promo planning'
          ] : []
        )
      ) : [],
      guidance: guidanceDeduped,
      scores: {
        // All scores in 0–100 for consistency
        overall: overallScore100,
        problem: Math.round(problemScore10 * 10),
        underserved: 0, // placeholder; set below using saturationOut (now 0–100)
        feasibility: Math.round(((typeof result.scores.feasibility === 'number' ? Number(result.scores.feasibility) : 7) * 10)),
        differentiation: Math.round(Number(moatScore) * 10),
        demand_signals: Math.round(Number(demandScore) * 10),
  wtp: Math.round(Number(economicsScore) * 10),
        // Previously 0–10; now 0–100 (clamped first on /10 then scaled)
        market_quality: Math.round(marketQualityClamped * 10),
        gtm: Math.round(Number(distributionScore) * 10),
        execution: Math.round((typeof result.scores.execution === 'number' ? Number(result.scores.execution) : 6) * 10),
        // Risk scaled to 0–100
        risk: Math.round((saturationOut >= 95 ? 8.5 : saturationOut >= 90 ? 8.0 : saturationOut >= 80 ? 7.0 : 6.0) * 10)
      },
  flags,
      adjustments,
      math: {
        weights: {
          problem: weightProblem,
          underserved: weightUnderserved,
          demand: weightDemand,
          differentiation: weightMoat,
          economics: weightEconomics,
          gtm: weightGtm
        },
        contributions: {
          problem: Number(contribProblem.toFixed(3)),
          underserved: Number(contribUnderserved.toFixed(3)),
          demand: Number(contribDemand.toFixed(3)),
          differentiation: Number(contribMoat.toFixed(3)),
          economics: Number(contribEconomics.toFixed(3)),
          gtm: Number(contribGtm.toFixed(3))
        },
        overall10: Number(overall10.toFixed(3)),
        overallPercentPreCaps: Math.round((contribProblem + contribUnderserved + contribDemand + contribMoat + contribEconomics + contribGtm) * 10),
        marketRealityCap,
        economicsRatio: econRatio,
        economicsCap10FromRatio: econCap10FromRatio,
        extremeLowSignals: { badProblem, badUnderserved, badDemand, badEconomics, extremeLowCount }
      },
  created_at: nowISO,
      market_intelligence: {
        industry: result.business_dna.industry || 'General',
        marketCategory,
        saturationPct: saturationOut,
        saturationLevel: (saturationOut / 100),
        majorCompetitors,
        // Aliases for UI compatibility
        majorPlayers: majorCompetitors,
        major_players: majorCompetitors,
        avgCustomerAcquisitionCost: assumptions?.marketCAC ?? 400,
        avgCACRange,
        avgChurnRate: assumptions?.churnRate ?? 0.2,
        barrierToEntry: saturationOut >= 80 ? 2 : 4,
        economicsExplanation,
        
        // Add fields expected by PDF component
        marketSize: isProjectManagement ? '$50B global PM software market' :
                   isCoffeeSubscription ? '$15B coffee market' :
                   isHandmadeDTC ? '$8B artisan marketplace' :
                   isCustomerSupport ? '$24B customer service software' :
                   isEdtechMarketplace ? '$350B global education market' :
                   saturationOut >= 80 ? 'Large established market' : 'Emerging/niche market',
        cagr: isProjectManagement ? '12% annually' :
              isCoffeeSubscription ? '8% annually' :
              isHandmadeDTC ? '15% annually' :
              isCustomerSupport ? '14% annually' :
              isEdtechMarketplace ? '8% annually' :
              saturationOut >= 80 ? '5-8% annually' : '12-20% annually',
        saturation: saturationOut,
        avgCAC: assumptions?.marketCAC ?? 400,
        barriers: saturationOut >= 80 ? [
          'High customer acquisition costs',
          'Established competitor dominance',
          'Network effects benefit incumbents',
          'High switching costs for customers',
          'Significant capital requirements'
        ] : [
          'Market education needed',
          'Limited funding available',
          'Finding product-market fit',
          'Building initial customer base'
        ],
        
        keyTrends: isProjectManagement ? ['AI copilots in PM tools', 'Vertical specialization', 'OS-like workspaces (Notion, ClickUp)'] : undefined,
        keyMarketInsights: isProjectManagement ? [
          'Incumbent Advantage: Existing tools have 5–10x more features',
          'Customer Lock-in: High switching costs due to workflow integration',
          'Funding Reality: Need $2–5M to compete effectively in this space',
          'Success Rate: <5% for generic PM tools launched post-2020'
        ] : undefined,
        recommendedPivotStrategies: pivotSuggestions[detectedCategoryKey],
        assessmentConfidence: {
          // Confidence in these assessments (percent). Conservative defaults; surface transparently in UI
          marketSaturationPct: 95,
          cacEstimatesPct: 80,
          successRateProjectionsPct: 70
        },
        benchmarkComparison: {
          typicalSuccessRange: [65, 85] as [number, number],
          thisIdeaScore: overallScore100,
          // Keep original field name for compatibility while aligning text to new mapping
          gapIndicates: gapAnalysis,
          // New alias as requested in spec
          gap_analysis: gapAnalysis,
          // Comparative benchmarks for side-by-side UI
          comparative: {
            current_category_score: overallScore100,
            successful_verticals_score: 70,
            note: 'Typical successful verticalized entrants land 70%+' 
          }
        },
        visualization: {
          scoreAxis: { min: 0, max: 100 },
          current: { overall: overallScore100 },
          successBand: { from: 65, to: 85 },
          histogram: {
            // Simple static buckets representing observed distribution silhouettes
            buckets: [
              { range: [0, 20], density: 0.30 },
              { range: [20, 40], density: 0.35 },
              { range: [40, 60], density: 0.20 },
              { range: [60, 80], density: 0.10 },
              { range: [80, 100], density: 0.05 }
            ]
          }
        },
        marketDataSources: [
          'Competitor valuations: PitchBook, Crunchbase',
          'CAC estimates: SaaS industry benchmarks',
          'Success rates: CB Insights startup data'
        ],
        riskAnalysis: (
          isProjectManagement
            ? {
                probabilityToMillionARRPct: 10,
                expectedTimeToProfitabilityMonths: 36,
                requiredFundingUSDRange: [2000000, 5000000] as [number, number],
                recommendedTeamExperienceYears: 5
              }
            : (isGenericMarketplace
                ? {
                    probabilityToMillionARRPct: 10,
                    expectedTimeToProfitabilityMonths: 36,
                    requiredFundingUSDRange: [3000000, 7000000] as [number, number],
                    recommendedTeamExperienceYears: 5
                  }
                : (isCustomerSupport
                    ? {
                        probabilityToMillionARRPct: 10,
                        expectedTimeToProfitabilityMonths: 30,
                        requiredFundingUSDRange: [2000000, 5000000] as [number, number],
                        recommendedTeamExperienceYears: 5
                      }
                    : (saturationOut >= 85
                        ? {
                            probabilityToMillionARRPct: 12,
                            expectedTimeToProfitabilityMonths: 30,
                            requiredFundingUSDRange: [1500000, 4000000] as [number, number],
                            recommendedTeamExperienceYears: 4
                          }
                        : undefined
                      )
                  )
            )
        ),
        riskAnalysisSummary: (
          isProjectManagement
            ? [
                'Probability of reaching $1M ARR: <10%',
                'Expected time to profitability: 36+ months',
                'Required funding to compete: $2–5M',
                'Recommended team experience: 5+ years in PM'
              ]
            : (isGenericMarketplace
                ? [
                    'Probability of reaching $1M GMV take-rate: <10%',
                    'Two-sided growth and disintermediation are primary risks',
                    'Expected time to profitability: 36+ months',
                    'Recommended team experience: 5+ years in marketplaces or growth'
                  ]
                : (isCustomerSupport
                    ? [
                        'Probability of reaching $1M ARR: <10%',
                        'Displacement of incumbents requires clear ROI and migration tooling',
                        'Expected time to profitability: 30+ months',
                        'Recommended team experience: 5+ years in support tooling or CX ops'
                      ]
                    : (saturationOut >= 85
                        ? [
                            'Highly competitive space; clear wedge required',
                            'Expected time to profitability: 30+ months',
                            'Recommended team experience: 4+ years in the target vertical'
                          ]
                        : undefined
                      )
                  )
            )
        ),
        timelineMonthsToMVP: isProjectManagement ? 4 : 3,
        timelineMonthsToFirstRevenue: isProjectManagement ? 6 : 5,
        suggestedTeam: isProjectManagement ? ['2–3 engineers', '1 designer', 'part-time PM/Founder'] : ['2 engineers', '1 designer'],
        buildCostRange: isProjectManagement ? [60000, 150000] : [40000, 100000]
      },
      economics_breakdown: {
        estimatedCAC: assumptions?.marketCAC ?? 800,
        estimatedLTV: Math.round(econ.ltv ?? 0),
        ltvCacRatio: econ.ltvCacRatio ?? 0,
        paybackMonths: Math.round(econ.paybackMonths ?? 0)
      },
      // Add financial analysis for PDF component
      financial_analysis: {
        startupCosts: isProjectManagement ? 120000 :
                     isCoffeeSubscription ? 85000 :
                     isHandmadeDTC ? 25000 :
                     isCustomerSupport ? 95000 :
                     isEdtechMarketplace ? 65000 :
                     saturationOut >= 80 ? 100000 : 45000,
        unitEconomics: {
          verdict: econ.ltvCacRatio && econ.ltvCacRatio >= 3 ? 'Healthy unit economics' :
                   econ.ltvCacRatio && econ.ltvCacRatio >= 2 ? 'Moderate unit economics' :
                   'Challenging unit economics',
          benchmark: 'Target LTV:CAC ratio >3:1, payback <12 months',
          calculations: {
            paybackMonths: Math.round(econ.paybackMonths ?? 12),
            ltvCacRatio: Number((econ.ltvCacRatio ?? 2.1).toFixed(1)),
            monthlyRevenue: isProjectManagement ? 15000 :
                           isCoffeeSubscription ? 8500 :
                           isHandmadeDTC ? 3200 :
                           isCustomerSupport ? 12000 :
                           5000
          },
          warnings: econ.ltvCacRatio && econ.ltvCacRatio < 2 ? [
            'LTV:CAC ratio below recommended 3:1 threshold',
            'Extended payback period may strain cash flow',
            'Consider optimizing pricing or reducing acquisition costs'
          ] : []
        },
        breakeven: {
          timeMonths: isProjectManagement ? 36 :
                     isCoffeeSubscription ? 24 :
                     isHandmadeDTC ? 18 :
                     isCustomerSupport ? 30 :
                     saturationOut >= 80 ? 32 : 22,
          customerCount: Math.round(((isProjectManagement ? 120000 :
                                    isCoffeeSubscription ? 85000 :
                                    isHandmadeDTC ? 25000 :
                                    isCustomerSupport ? 95000 :
                                    65000) / 
                                    ((Number(hybridInput?.price_point) || 29.99) * 12)) * 1.5),
          viabilityWarning: saturationOut >= 90 ? 
            'High market saturation increases customer acquisition difficulty' : null
        },
        warnings: [
          ...(saturationOut >= 90 ? ['Market saturation significantly increases CAC'] : []),
          ...(econ.ltvCacRatio && econ.ltvCacRatio < 2 ? ['Unit economics below sustainable threshold'] : []),
          ...(isProjectManagement ? [
            'Competing against well-funded incumbents requires substantial capital',
            'Feature parity expectations from enterprise customers'
          ] : []),
          ...(isCoffeeSubscription ? [
            'Inventory costs and spoilage risk impact margins',
            'Shipping costs vary significantly by geography'
          ] : [])
        ]
      },
      // Add recommended actions for PDF component  
      recommended_actions: (() => {
        const score = overallScore100;
        if (score < 40) {
          return {
            immediate: [
              'STOP all development on current idea',
              'Cease additional capital deployment', 
              'Redirect effort toward pivot exploration'
            ],
            firstWeek: [
              'Review pivot opportunities in detail',
              'Select 1-2 pivot directions for rapid validation',
              'Schedule expert interviews in shortlisted pivot domains'
            ],
            monthOne: [
              'Complete 15+ discovery interviews across pivot areas',
              'Benchmark incumbent offerings and pricing',
              'Define validation metrics and early adopter criteria'
            ],
            timeline: 'Immediate pivot required'
          };
        }
        
        if (score > 70) {
          return {
            immediate: [
              'Prioritise high-impact roadmap items tied to validated demand',
              'Allocate budget to channels with proven CAC efficiency', 
              'Formalise success metrics and operating cadence'
            ],
            next30Days: [
              'Launch targeted experiments to double down on strongest growth channel',
              'Recruit advisors or hires filling execution gaps',
              'Spin up KPI dashboard tracking activation, retention, and payback'
            ],
            timeline: 'Proceed with focused execution'
          };
        }
        
        return {
          immediate: [
            'Run additional discovery calls to close evidence gaps',
            'Validate pricing and willingness to pay with real customers',
            'Stress test projections with sensitivity analysis'
          ],
          next30Days: [
            'Prioritise experiments addressing weakest score dimension',
            'Prepare lightweight pivot scenarios if metrics stagnate',
            'Define go/no-go metrics for the next milestone review'
          ],
          timeline: 'Continue validation with guarded investment'
        };
      })(),
      product_constraints: (() => {
        try {
          if (isHandmadeDTC) {
            const bodiesRec = (additionalFields as Record<string, unknown>) || {};
            const capacityPerWeek = Number.isFinite(bodiesRec.capacity_per_week as number) ? Number(bodiesRec.capacity_per_week as number) : undefined;
            const avgMakeTimeMin = Number.isFinite(bodiesRec.avg_make_time_min as number) ? Number(bodiesRec.avg_make_time_min as number) : undefined;
            const fragility = /ceramic|glass|pottery|fragile/i.test(fullIdeaText) ? 'high' : undefined;
            return {
              handmade: true,
              capacity_units_per_week: capacityPerWeek,
              avg_make_time_min: avgMakeTimeMin,
              lead_time_days: fragility ? 7 : 5,
              qc_reject_rate_pct: 5,
              breakage_rate_pct: fragility ? 4 : 2,
              seasonality: ['Q4 gifting', 'weddings', 'Mother’s Day'],
              notes: [
                'Throughput bound by maker hours; consider batch workflows and pre‑orders',
                'QC and rework contribute to effective COGS',
                'Fragile shipping increases breakage/returns and packaging costs'
              ]
            };
          }
          if (isCraftMarketplace) {
            return {
              marketplace: true,
              supply_onboarding_hours: 1.5,
              dispute_rate_pct: 1.2,
              chargeback_rate_pct: 0.4,
              curation_throughput_per_week: 25,
              notes: [
                'Liquidity requires balanced supply and demand in a niche/geo',
                'Trust features (escrow, ratings, dispute resolution) reduce leakage',
                'Ops cost grows with curation/QA and dispute handling'
              ]
            };
          }
        } catch {}
        return undefined;
      })(),
      // Expose hybrid classifier output so UI can key off business model reliably
      business_dna: result.business_dna,
      // Whether this result was persisted to the database (controls client routing)
      persisted: false
    } as const;

  // Attach structural barriers map for UI gating and explanations
  try {
    const saturated_category = saturationOut >= 90;
    const dominated_marketplace = (
      (isGenericMarketplace || isEdtechMarketplace || isCreativeMarketplace || isProjectManagement || isCustomerSupport || isVerticalComms)
      && Array.isArray(majorCompetitors) && majorCompetitors.length >= 3
    );
    const midCAC = Array.isArray(avgCACRange) ? ((avgCACRange[0] + avgCACRange[1]) / 2) : undefined;
    const paid_acquisition = typeof midCAC === 'number' && (
      (isProjectManagement && midCAC >= 400) ||
      (isCustomerSupport && midCAC >= 600) ||
      ((isGenericMarketplace || isCreativeMarketplace || isEdtechMarketplace) && midCAC >= 700) ||
      (isPhysicalSubscription && midCAC >= 180)
    );
    let improvement_allowed = true;
    if (!isPhysicalSubscription) {
      if (saturated_category && (dominated_marketplace || paid_acquisition || flags.includes('CAPPED_BY_SATURATED_CATEGORY_15'))) {
        improvement_allowed = false;
      }
    }
  (response as Record<string, unknown>).barriers = {
      improvement_allowed,
      saturated_category: saturated_category || undefined,
      dominated_marketplace: dominated_marketplace || undefined,
      paid_acquisition: paid_acquisition || undefined,
    };
  } catch {}

  // Attach adaptive validation snapshot (light integration for transparency)
  try {
    const inferredModel = inferModelFromHints({
  businessModel: String(((result as unknown as { business_dna?: { businessModel?: string } }).business_dna?.businessModel) || ''),
      category: String(marketCategory || ''),
      flags,
    });
    const adaptive = evaluateAdaptive({
      model: inferredModel,
      saturationPct: saturationOut,
      dimensions10: {
        problem: Number(problemScore10),
        underserved: Number(underserved10),
        demand: Number(demandScore),
        differentiation: Number(moatScore),
        economics: Number(economicsScore),
        gtm: Number(distributionScore),
      },
    });
    (response as any).adaptive_validation = adaptive;
    // Surface classification and math transparency
  (response as Record<string, unknown>).business_model = {
      detected_category_key: detectedCategoryKey,
      inferred_model: inferredModel,
      flags,
    };
  (response as Record<string, unknown>).adaptive_math = {
      inputs10: {
        problem: Number(problemScore10),
        underserved: Number(underserved10),
        demand: Number(demandScore),
        differentiation: Number(moatScore),
        economics: Number(economicsScore),
        gtm: Number(distributionScore),
      },
      weights: adaptive.weights,
      gates: adaptive.gates,
      gate_violations: adaptive.gateViolations,
      applied_caps: adaptive.appliedCaps,
      overall_pre_caps: adaptive.overall100PreCaps,
      overall_post_caps: adaptive.overall100PostCaps,
      saturationPct: saturationOut,
    };
    if (adaptive.gates.saturationCapOverall100 && saturationOut >= 90) {
  (response as Record<string, unknown>).saturation_caps = {
        model: inferredModel,
        saturationPct: saturationOut,
        overall_cap100: adaptive.gates.saturationCapOverall100,
        applied: true,
      };
    }
  } catch {}

  // Policy activation and criteria (framework surfacing)
  try {
    const ctx = {
      businessModelType: (isGenericMarketplace || isEdtechMarketplace)
        ? 'marketplace'
        : (isCoffeeSubscription || isPhysicalSubscription)
          ? 'dtc'
          : (isProjectManagement || isCustomerSupport || isVerticalComms)
            ? 'b2b'
            : 'b2c',
      industry: String(result?.business_dna?.industry || marketCategory || 'General'),
      revenueModelComplexity: (isProjectManagement || isCustomerSupport) ? 'tiered' : 'simple',
      targetCustomer: (isGenericMarketplace || isEdtechMarketplace) ? 'two-sided' : ((isCoffeeSubscription || isPhysicalSubscription) ? 'consumer' : 'smb'),
      operationalComplexity: (isCoffeeSubscription || isPhysicalSubscription) ? 'physical' : 'digital',
    } as const;
    const decision = decidePolicy(ctx);
  (response as Record<string, unknown>).policy = { model_key: decision.modelKey, notes: decision.notes || [] };
  (response as Record<string, unknown>).activated_frameworks = decision.frameworks;
    (response as any).validation_criteria = getValidationCriteria(decision);

    // Evaluate dynamic rules and merge flags/gates
    try {
      const kv = getKV();
      const RULES_KEY = 'adaptive:rules';
      const engine = new InMemoryRuleEngine();
      const rules = (await kv.get<RuleDefinition[]>(RULES_KEY)) || await engine.list();
      const actions = await engine.evaluate(rules, {
        model: decision.modelKey,
        saturationPct: saturationOut,
        dimensions10: {
          problem: Number(problemScore10),
          underserved: Number(underserved10),
          demand: Number(demandScore),
          differentiation: Number(moatScore),
          economics: Number(economicsScore),
          gtm: Number(distributionScore),
        },
        category: marketCategory,
        flags,
      } as any);
      const rulePenalties: string[] = [];
      for (const a of actions) {
        if ((a as any).type === 'flag') {
          const code = (a as any).code as string;
          if (code && !flags.includes(code)) flags.push(code);
        } else if ((a as any).type === 'gate') {
          const g = (a as any);
          const code = `RULE_GATE_${String(g.dimension || 'overall').toUpperCase()}_${String(g.action || 'review').toUpperCase()}`;
          if (!flags.includes(code)) flags.push(code);
          if (g.reason) rulePenalties.push(`${String(g.dimension || 'overall').toUpperCase()}: ${g.reason}`);
          else rulePenalties.push(`${String(g.dimension || 'overall').toUpperCase()}: ${String(g.action).toUpperCase()} required`);
        }
      }
      (response as any).rules_evaluated = { total: Array.isArray(rules) ? rules.length : 0, triggered: actions.length };
      if (rulePenalties.length) (response as any).rule_penalties = rulePenalties;
    } catch {}

    // Optional metrics snapshot for DTC physical subscriptions
    try {
      if (isPhysicalSubscription && physicalEcon) {
        const mean = Math.max(0, Number(physicalEcon.contributionPerMonth || 0));
        const sd = Math.max(1, Math.round(mean * 0.2));
        const cacVal = Number(physicalEcon.assumptions.marketCAC || 0);
        const churn = Number(physicalEcon.assumptions.churnRate || 0.08);
        if (mean > 0 && cacVal > 0) {
          const pay = simulatePayback({ runs: 3000 }, { meanMonthlyContribution: mean, sdMonthlyContribution: sd, cac: cacVal, churnRateMonthly: churn, maxMonths: 24 });
          const ltvBands = simulateLTVCAC({ runs: 3000 }, { ltvMean: Number(physicalEcon.ltv || 0), ltvSd: Math.max(1, Math.round((Number(physicalEcon.ltv || 0)) * 0.25)), cacMean: cacVal, cacSd: Math.max(1, Math.round(cacVal * 0.3)), capRatio: 12 });
          (response as any).metrics_snapshot = {
            payback: pay,
            ltv_cac: ltvBands,
          };
        }
      }
    } catch {}
  } catch {}

  // Finalize underserved now that saturationOut is known (0–100)
  (response as any).scores.underserved = Math.max(0, Math.min(100, Math.round(100 - saturationOut)));
    // Attach detailed explanations
    (response as any).why = why;
  // Penalties with live benchmarks from adjustments
  const penalties = (adjustments || []).filter(a => a.kind === 'cap').map(a => {
    const bench: any = a.benchmark || {};
    const reason = a.reason || 'Adjustment applied';
    const details: string[] = [];
    if (bench.saturationPct != null) details.push(`Market saturation: ${bench.saturationPct}%`);
    if (bench.capMax10 != null) details.push(`Score capped at ${bench.capMax10}/10`);
    if (bench.capMax100 != null) details.push(`Score capped at ${bench.capMax100}/100`);
    if (bench.ltvCac != null) details.push(`LTV:CAC = ${bench.ltvCac}`);
    if (bench.cap10 != null) details.push(`Economics capped at ${bench.cap10}/10`);
    if (bench.proportionalFloor10 != null) details.push(`Demand floor set to ${bench.proportionalFloor10}/10`);
    return `${a.dimension.toUpperCase()}: ${reason}${details.length ? ' — ' + details.join('; ') : ''}`;
  });
  {
    const rulePen = ((response as any).rule_penalties as string[] | undefined) || [];
    (response as any).penalties = rulePen.length ? penalties.concat(rulePen.map(p => `RULE: ${p}`)) : penalties;
  }

    // Live experiment prompts when caps applied
    const anyCaps = adjustments.some(a => a.kind === 'cap');
    if (anyCaps) {
      const experiments: string[] = [];
      if (detectedCategoryKey === 'learning-marketplace') {
        experiments.push(
          'Supply seeding: recruit 5–10 instructors with proof of outcomes; offer revenue floors for first cohorts.',
          'Cohort pilot: run 1 live cohort (30–50 learners) to validate completion and NPS; collect testimonials.',
          'Distribution test: partner with 2 micro-communities/newsletters; target 200 visits and 40–60 signups in 2 weeks.'
        );
      } else if (detectedCategoryKey === 'freelance-marketplace' || detectedCategoryKey === 'services-marketplace') {
        experiments.push(
          'Run a landing page campaign for technical illustration architects in Georgia. Target: 50 signups in 2 weeks.',
          'Survey 20 D2C packaged goods founders about pain with outsourced design platforms; capture current tools and top gaps.',
          'Pilot managed escrow and structured briefs in one city/vertical for 10 matched projects before scaling.'
        );
      } else if (detectedCategoryKey === 'pm-software') {
        experiments.push(
          'Vertical PM smoke test: one-page landing for construction change-order workflows; 50 targeted visits; target 10 signups in 14 days.',
          '5 founder interviews in the chosen vertical to validate top 3 pains and willingness to switch.',
          'Prototype one workflow automation and run a 2-customer paid pilot at list price.'
        );
      } else if (detectedCategoryKey === 'customer-support') {
        experiments.push(
          'ROI proof: implement a docs/search improvement with 1 design partner; measure deflection rate over 2 weeks.',
          'Migration test: build a CSV importer for Zendesk/Freshdesk; run a guided migration with 2 teams.',
          'In-product support A/B: add contextual tips in one product area; measure time-to-first-response and reopen rates.'
        );
      } else {
        experiments.push(
          'ICP discovery: 5–7 interviews to validate pains and desired outcomes; synthesize top jobs-to-be-done.',
          'Landing + waitlist smoke test: 50 targeted visits via 2 channels; target 10–20 signups in 2 weeks.',
          '1–2 paid pilot offers at target price; measure activation and retention in week 1.'
        );
      }
      // Strengthen goals and category-aware targets
      const goalLine = (detectedCategoryKey === 'freelance-marketplace' || detectedCategoryKey === 'services-marketplace' || detectedCategoryKey === 'learning-marketplace')
        ? 'Target: 25 qualified signups in 2 weeks.'
        : (detectedCategoryKey === 'pm-software'
            ? 'Target: 10–20 qualified signups in 2 weeks.'
            : 'Target: 10–20 qualified signups in 2 weeks.');
      experiments.push(goalLine);
      (response as any).experiments = experiments;
    }
    // Experiments checklist + progress hints
    (response as any).experiments_checklist = [
      'Define narrow ICP (role, industry, geo)',
      'Launch landing page with clear wedge and proof points',
      'Run 5–7 interviews; synthesize top jobs/pains',
      'Execute paid pilot with 1–2 customers',
      'Measure signup rate (>20%), CAC proxy, retention proxy',
      'Rescore weekly; document deltas'
    ];
    (response as any).progress = {
      cadence: 'weekly',
      track: ['signups', 'paid pilots', 'retention proxy', 'time-to-first-value'],
      shareable: true
    };

  // Weighted opportunities: when GTM/moat outpace problem/demand, suggest a pivot path with a simple what-if
    const avgGrowth10 = (Number(moatScore) + Number(distributionScore)) / 2;
    const avgFit10 = (Number(problemScore10) + Number(demandScore)) / 2;
    if (avgGrowth10 >= avgFit10 + 1) {
      // Constrain saturation drop and problem cap in saturated PM: vertical focus can't erase incumbents
      const whatIfSaturation = (isProjectManagement)
        ? Math.max(92, saturationOut - 3)
        : Math.max(70, saturationOut - 10); // generic assumption for niche/managed
      const whatIfUnderserved10 = Number(((100 - whatIfSaturation) / 10).toFixed(1));
      let whatIfProblemMax100 = whatIfSaturation >= 90 ? 25 : (whatIfSaturation >= 85 ? 35 : 45);
      if (isProjectManagement) whatIfProblemMax100 = 18; // align with earlier PM cap range (10–18)
      const problemBumpMax = isProjectManagement ? 5 : 10; // PM improvement bounded
      const estProblem100 = Math.min(Math.round(problemPctOriginal + problemBumpMax), whatIfProblemMax100);
      const estProblem10 = Number((estProblem100 / 10).toFixed(1));
      const estDemand10 = Number(Math.min(Number(demandScore) + 1.5, (whatIfSaturation >= 95 || isProjectManagement || isGenericMarketplace) ? 3.5 : (whatIfSaturation >= 90 ? 4.0 : 5.0)).toFixed(1));
      const estOverall10 = (
        estProblem10 * weightProblem +
        whatIfUnderserved10 * weightUnderserved +
        estDemand10 * weightDemand +
        Number(moatScore) * weightMoat +
        Number(economicsScore) * weightEconomics +
        Number(distributionScore) * weightGtm
      );
      const estOverall100 = Math.round(estOverall10 * 10);
      // Enforce adaptive caps on projections using the policy model
      const adaptiveWhatIf = (() => {
        try {
          return evaluateAdaptive({
            model: ((response as any)?.policy?.model_key) || inferModelFromHints({ category: String(marketCategory || ''), flags }),
            saturationPct: whatIfSaturation,
            dimensions10: {
              problem: Number(estProblem10),
              underserved: Number(whatIfUnderserved10),
              demand: Number(estDemand10),
              differentiation: Number(moatScore),
              economics: Number(economicsScore),
              gtm: Number(distributionScore),
            },
          });
        } catch { return null; }
      })();
      const estOverall100Capped = adaptiveWhatIf ? adaptiveWhatIf.overall100PostCaps : estOverall100;
      (response as any).opportunities = {
        insights: [
          'Your GTM and differentiation are stronger than problem/demand — use them as a wedge',
          'A niche or managed approach can reduce saturation and improve perceived problem fit'
        ],
        conditional_path: 'You can win if you dominate a city/creative subvertical and add managed features that reduce leakage and increase trust.',
        what_if: {
          scenario: isGenericMarketplace || isCreativeMarketplace ? 'Niche + Managed marketplace' : (isProjectManagement ? 'Vertical PM niche' : 'Industry specialization'),
          assumptions: { currentSaturationPct: saturationOut, newSaturationPct: whatIfSaturation },
          estimated_scores: {
            problem: Math.round(estProblem10 * 10),
            underserved: Math.round(whatIfUnderserved10 * 10),
            demand_signals: Math.round(estDemand10 * 10),
            overall: estOverall100Capped,
          },
          deltas: {
            problem: Math.round(estProblem10 * 10) - Math.round(problemScore10 * 10),
            underserved: Math.round(whatIfUnderserved10 * 10) - Math.round(underserved10 * 10),
            demand_signals: Math.round(estDemand10 * 10) - Math.round(Number(demandScore) * 10),
            overall: estOverall100 - overallScore100
          },
          // Segment-by-segment explanation to visualize expected lift
          segment_deltas: [
            {
              dimension: 'problem',
              from: Math.round(problemScore10 * 10),
              to: Math.round(estProblem10 * 10),
              delta: Math.round(estProblem10 * 10) - Math.round(problemScore10 * 10),
              reason: isProjectManagement
                ? 'Vertical workflow specialization may slightly improve problem clarity; bounded by incumbent coverage'
                : 'Vertical focus clarifies pain and fit for one ICP'
            },
            {
              dimension: 'underserved',
              from: Math.round(underserved10 * 10),
              to: Math.round(whatIfUnderserved10 * 10),
              delta: Math.round(whatIfUnderserved10 * 10) - Math.round(underserved10 * 10),
              reason: 'Niche + managed approach reduces effective saturation'
            },
            {
              dimension: 'demand_signals',
              from: Math.round(Number(demandScore) * 10),
              to: Math.round(estDemand10 * 10),
              delta: Math.round(estDemand10 * 10) - Math.round(Number(demandScore) * 10),
              reason: 'Concierge onboarding + escrow/QA increase trust and activation'
            },
            {
              dimension: 'overall',
              from: overallScore100,
              to: estOverall100Capped,
              delta: estOverall100Capped - overallScore100,
              reason: 'Combined lift from focus and managed workflows (respecting caps)'
            }
          ],
          // Managed/niche what-if with reweighted GTM/Economics (emphasize go-to-market execution)
          estimated_scores_managed: (() => {
            const w = { problem: 0.15, underserved: 0.15, demand: 0.15, differentiation: 0.15, economics: 0.25, gtm: 0.15 } as const;
            const overall10m = (
              estProblem10 * w.problem +
              whatIfUnderserved10 * w.underserved +
              estDemand10 * w.demand +
              Number(moatScore) * w.differentiation +
              Number(economicsScore) * w.economics +
              Number(distributionScore) * w.gtm
            );
            const estOverallManaged = Math.round(overall10m * 10);
            let capped = estOverallManaged;
            try {
              const aw = evaluateAdaptive({
                model: ((response as any)?.policy?.model_key) || inferModelFromHints({ category: String(marketCategory || ''), flags }),
                saturationPct: whatIfSaturation,
                dimensions10: {
                  problem: Number(estProblem10),
                  underserved: Number(whatIfUnderserved10),
                  demand: Number(estDemand10),
                  differentiation: Number(moatScore),
                  economics: Number(economicsScore),
                  gtm: Number(distributionScore),
                },
              }, w as any);
              capped = aw.overall100PostCaps;
            } catch {}
            return { weights: w, overall: capped };
          })(),
          model_notes: 'Managed/niche strategies weight GTM and economics more heavily; success depends on localized liquidity and trust.'
        }
      };

      // If structural barriers block improvements, clamp what-if outputs to current levels (+0 deltas)
      try {
        const improvementAllowed = (response as any)?.barriers?.improvement_allowed !== false;
        if (!improvementAllowed && (response as any)?.opportunities?.what_if) {
          const wf = (response as any).opportunities.what_if as any;
          const currentProblem100 = Math.round(Number(problemScore10) * 10);
          const currentUnderserved100 = Math.round(Number(underserved10) * 10);
          const currentDemand100 = Math.round(Number(demandScore) * 10);
          // Replace estimated scores with current levels
          wf.estimated_scores = {
            problem: currentProblem100,
            underserved: currentUnderserved100,
            demand_signals: currentDemand100,
            overall: Number(overallScore100)
          };
          // Zero out deltas
          wf.deltas = {
            problem: 0,
            underserved: 0,
            demand_signals: 0,
            overall: 0
          };
          // Align segment deltas
          if (Array.isArray(wf.segment_deltas)) {
            wf.segment_deltas = wf.segment_deltas.map((seg: any) => ({
              ...seg,
              to: seg.from,
              delta: 0,
              reason: 'Held at current due to structural barriers'
            }));
          }
          // Keep managed weights visible but clamp projected overall
          if (wf.estimated_scores_managed && typeof wf.estimated_scores_managed === 'object') {
            wf.estimated_scores_managed.overall = Number(overallScore100);
          }
        }
      } catch {}

      // Conditional path message tailored to category
    const conditionalPath = (isGenericMarketplace || isCreativeMarketplace)
        ? 'You can win if you dominate a city or creative subvertical and add managed features (escrow, QA, onboarding) to reduce leakage.'
        : (isProjectManagement
            ? 'You can win by verticalizing workflows (e.g., construction change orders) and proving ROI with 1–2 paid pilots.'
      : (isCustomerSupport
                ? 'You can win by specializing in an industry and proving measurable deflection/time-to-first-response improvements.'
        : (detectedCategoryKey === 'vertical-comms'
          ? 'You can win by picking one vertical (e.g., dental clinics) and owning one must-have workflow (e.g., HIPAA-compliant receipts), bundled with onboarding and compliance automation.'
          : 'You can win by narrowing ICP and leading with a highly differentiated wedge that proves ROI quickly.')
              )
          );
      (response as any).conditional_path = conditionalPath;

      // Attach projected score to visualization for UI overlay (where you’d land)
      try {
        const viz = (response as any).market_intelligence?.visualization;
        if (viz) {
          viz.projected = { overall: estOverall100Capped };
          viz.overlays = [
            { type: 'band', from: 65, to: 85, label: 'Typical success range' },
            { type: 'marker', value: overallScore100, label: 'Current' },
            { type: 'marker', value: estOverall100, label: 'Projected (with pivot)' }
          ];
          // Progress path to success band for UI progress bar
          const bandFrom = 65, bandTo = 85;
          const pctToLow = Math.max(0, Math.min(1, overallScore100 / bandFrom));
          const toBandLowDelta = Math.max(0, bandFrom - overallScore100);
          const toBandMidDelta = Math.max(0, Math.round(((bandFrom + bandTo) / 2) - overallScore100));
          viz.progress = {
            current: overallScore100,
            band: { from: bandFrom, to: bandTo },
            projected: estOverall100,
            percentToBandLow: Number(pctToLow.toFixed(3)),
            toBandLowDelta,
            toBandMidDelta
          };

          // Respect structural barriers: if improvements are blocked, align projected to current
          const improvementAllowed = (response as any)?.barriers?.improvement_allowed !== false;
          if (!improvementAllowed) {
            viz.projected = { overall: overallScore100 };
            if (Array.isArray(viz.overlays)) {
              viz.overlays = [
                { type: 'band', from: 65, to: 85, label: 'Typical success range' },
                { type: 'marker', value: overallScore100, label: 'Current' },
                { type: 'marker', value: overallScore100, label: 'Projected (held by barriers)' }
              ];
            }
            if (viz.progress && typeof viz.progress === 'object') {
              viz.progress.projected = overallScore100;
            }
          }
        }
      } catch {}
    }

    // Expose model weights and an improvement loop to drive weekly iteration
    (response as any).model = {
      scoreWeights: {
        problem: weightProblem,
        underserved: weightUnderserved,
        demand: weightDemand,
        differentiation: weightMoat,
        economics: weightEconomics,
        gtm: weightGtm
      },
      // Surface unit economics explicitly when we used the physical model
      unit_economics: isPhysicalSubscription && physicalEcon ? {
        cac_payback_months: Number.isFinite(physicalEcon.paybackMonths) ? Number(physicalEcon.paybackMonths) : null,
        estimated_monthly_revenue: Number.isFinite(physicalEcon.contributionPerMonth) ? Math.round(physicalEcon.contributionPerMonth) : null,
      } : undefined,
      physical_subscription: isPhysicalSubscription && physicalEcon ? {
        pricing_per_box: physicalEcon.assumptions.pricingPerBox,
        boxes_per_month: physicalEcon.assumptions.boxesPerMonth,
        cogs_per_box: physicalEcon.assumptions.cogsPerBox,
        gross_margin_pct: Math.round(physicalEcon.grossMarginPct * 100) / 100,
        ltv_cac_ratio: physicalEcon.ltvCacRatio,
        notes: economicsExplanation,
        warnings: physicalEcon.warnings,
      } : undefined
    };
    // Improvement loop: branch for physical subscriptions (DTC) vs B2B/SaaS
    if (isPhysicalSubscription || String((result as any)?.business_dna?.businessModel || '').toLowerCase() === 'physical-subscription') {
      (response as any).improvement_loop = [
        'Launch waitlist + presale: 50 targeted visits/week; goal: 10–20 signups and 10–20 paid presales',
        'Add taste quiz + sampler; personalize first box to lift first‑box satisfaction',
        'Enable pause/skip/swap and easy variety changes in the account portal',
        'Track first‑box satisfaction (≥85%) within 7 days and 3‑month retention (≥70%); iterate offers',
        'Verify unit economics: gross margin ≥55%, CAC payback < 6 months, LTV:CAC ≥3; adjust pricing/COGS as needed'
      ];
    } else {
      (response as any).improvement_loop = [
        'Iterate your pitch based on interview insights; clarify ICP and outcomes',
        'Retarget one vertical or subvertical; relaunch the landing experiment',
        'Run weekly: 50 targeted visits, 10–20 signups goal; compare scores week over week',
        'Secure 1–2 paid pilots to validate WTP and activation; update economics inputs'
      ];
    }

    // Anti-leakage: loyalty strategies for marketplace categories
    if (detectedCategoryKey === 'learning-marketplace') {
      (response as any).platform_loyalty = {
        value_to_stay: [
          'Verified certificates, portfolios, and outcomes tracked on-platform (employability signal)',
          'Cohorts, office hours, and community support that increase completion and reduce refunds',
          'Creator tooling (analytics, feedback, monetization) that is hard to replicate off-platform',
          'Refund policies and quality bars that build trust for new learners'
        ],
        community_features: [
          'Peer groups, challenges, and project showcases to boost engagement',
          'Instructor reputation with verified credentials and track record',
          'Progression paths and badges tied to skill mastery and employability',
          'Scholarships/financial aid partners to expand access and demand'
        ]
      } as const;
    } else if (detectedCategoryKey === 'freelance-marketplace' || detectedCategoryKey === 'services-marketplace') {
      (response as any).platform_loyalty = {
        value_to_stay: [
          'Escrow & staged payouts with dispute resolution build trust and reduce leakage',
          'Compliance workflows (contracts, NDAs, KYB/KYC) and secure documents make the platform indispensable',
          'Managed services (structured briefs, QA reviews, curated matching) add value beyond introductions',
          'Guarantees/SLAs (rework credits, delivery guarantees) increase retention and platform preference'
        ],
        community_features: [
          'Reputation scores and verified credentials to reward reliability and reduce off-platform risk',
          'Tiered memberships (benefits, lower fees, faster payouts) for frequent, high-quality users',
          'Exclusive opportunities (invite-only jobs, events, education) to drive loyalty and status',
          'Leaderboards and milestone badges to incentivize ongoing participation'
        ]
      } as const;
    }

    // Compact human-readable summary for UI
    try {
      const firstTwoCompetitors = Array.isArray(majorCompetitors) && majorCompetitors.length 
        ? majorCompetitors.slice(0, 2).map((comp: {name: string} | string) => 
            typeof comp === 'string' ? comp : comp.name).join(', ') 
        : undefined;
      const topPenaltyReason = (() => {
        if (flags.includes('CAPPED_BY_SATURATED_CATEGORY_15')) return 'saturated category cap (≥90%)';
        const satOverall = adjustments.find(a => a.dimension === 'overall' && a.kind === 'cap');
        if (satOverall?.reason) return satOverall.reason;
        const econCap = adjustments.find(a => a.dimension === 'economics' && a.kind === 'cap');
        if (econCap?.reason) return econCap.reason;
        const demandCap = adjustments.find(a => a.dimension === 'demand' && a.kind === 'cap');
        if (demandCap?.reason) return demandCap.reason;
        return 'multiple penalties in a saturated market';
      })();

      const avgGrowth10_ = (Number(moatScore) + Number(distributionScore)) / 2;
      const avgFit10_ = (Number(problemScore10) + Number(demandScore)) / 2;
      const strongerDimension = avgGrowth10_ >= avgFit10_ + 1
        ? 'GTM and differentiation'
        : (Number(moatScore) >= Number(distributionScore) ? 'differentiation' : 'GTM');

      const projectedOverall = (response as any)?.opportunities?.what_if?.estimated_scores?.overall as number | undefined;
      const improvementsBlocked = (response as any)?.barriers?.improvement_allowed === false;
      const projectedLine = improvementsBlocked
        ? 'Improvements are held at current levels due to structural barriers (e.g., saturation/paid acquisition). Focus on a narrower niche or new wedge.'
        : ((typeof projectedOverall === 'number' && projectedOverall > overallScore100)
            ? `If traction >20%, your score could improve to ~${projectedOverall}% (+${projectedOverall - overallScore100}).`
            : 'If signup rate exceeds 20%, your score could significantly improve with this wedge.');

      // Category-aware action bullets
      const isMarketplaceKey = (detectedCategoryKey === 'freelance-marketplace' || detectedCategoryKey === 'services-marketplace' || detectedCategoryKey === 'learning-marketplace');
      const immediateActions = detectedCategoryKey === 'learning-marketplace'
        ? [
            'Onboard 5–10 credible instructors with outcome proof and run 1 live cohort (30–50 learners).',
            'Implement verified certificates/portfolios and clear refund policies to build trust.',
            'Partner with 2 micro-communities/newsletters to drive first 200 visits and 40–60 signups in 14 days.',
            projectedLine
          ]
        : isMarketplaceKey
          ? [
              'Launch a Miami-based packaging designer collective for D2C beverage founders (seed both sides locally).',
              'Add managed workflows: escrow, structured briefs, QA review, and concierge onboarding.',
              'Run a local experiment: landing page + webinar + LinkedIn outreach; target 50 visits and 10–20 signups in 14 days.',
              projectedLine
            ]
        : (detectedCategoryKey === 'pm-software'
            ? [
                'Verticalize one workflow (e.g., construction change-order PM).',
                'Prove ROI with 1–2 paid pilots; measure activation and switching intent.',
                'Run a focused landing test (50 visits, 10–20 signups target).',
                projectedLine
              ]
            : (detectedCategoryKey === 'customer-support'
                ? [
                    'Specialize in an industry; build migration tooling and ROI proof (deflection/time-to-first-response).',
                    'Run 1 design partner experiment and measure outcomes within 2 weeks.',
                    'Targeted landing + outreach to 50 ICPs; aim for 10–20 signups.',
                    projectedLine
                  ]
                : (detectedCategoryKey === 'vertical-comms'
                    ? [
                        'Pick one vertical (e.g., local clinics) and one painful workflow (e.g., automated receipts with HIPAA BAAs).',
                        'Ship one killer feature (e.g., compliance automation or one-click EHR/CRM reporting).',
                        'Run a landing page for that narrow use case; goal: 25 signups in 2 weeks and 5 demo requests.',
                        projectedLine
                      ]
                    : [
                    'Clarify ICP and top 3 pains; run 5–7 interviews.',
                    'Launch a landing + waitlist test (50 visits, 10–20 signups target).',
                    'Secure 1–2 paid pilots at target price.',
                    projectedLine
                  ])
              )
          );

      const platformGuidance = detectedCategoryKey === 'learning-marketplace'
        ? [
            'Start with a cohort-based beachhead to maximize completion and social proof.',
            'Add certificates, portfolios, and outcome tracking; enforce a quality bar to reduce refunds.',
            'Partner with micro-communities for distribution; rescore weekly.'
          ]
        : isMarketplaceKey
          ? [
              'Pick a vertical/city (reach liquidity in a beachhead).',
              'Add “irreplaceable” managed features (QA, compliance/KYB/KYC, escrow).',
              'Run experiments, rescore weekly.'
            ]
        : (detectedCategoryKey === 'pm-software'
            ? [
                'Pick one vertical workflow to own.',
                'Prove ROI with paid pilots before broadening.',
                'Run experiments, rescore weekly.'
              ]
            : (detectedCategoryKey === 'regulated-services'
                ? [
                    'Start with one regulated vertical and city (e.g., SOC 2 auditors for SaaS in Austin).',
                    'Add escrow, compliance checks, and secure doc handling to become irreplaceable.',
                    'Deliver 5–10 managed engagements and measure leakage and satisfaction.',
                    'Rescore weekly.'
                  ]
                : [
                'Specialize by vertical/use-case.',
                'Prove measurable ROI with a design partner.',
                'Run experiments, rescore weekly.'
              ])
          );

      const whyLines: string[] = [];
      whyLines.push(
        `Market saturation ${saturationOut}%${firstTwoCompetitors ? ` (${firstTwoCompetitors} dominant)` : ''}.`
      );
      if (economicsExplanation) {
        whyLines.push(String(economicsExplanation));
      }

      const headline = `Your idea scored ${overallScore100}% due to ${topPenaltyReason}.`;
      const goodNews = `Your ${strongerDimension} are stronger than average — use them as a wedge.`;

      (response as any).summary = {
        headline,
        why: whyLines,
        good_news: goodNews,
        immediate_action: immediateActions,
        platform_guidance: platformGuidance,
        projected: (typeof projectedOverall === 'number' && projectedOverall > overallScore100)
          ? { overall: projectedOverall, delta: projectedOverall - overallScore100 }
          : undefined
      };

      // Managed features rollout and geo plan
      if (detectedCategoryKey === 'learning-marketplace') {
        (response as any).managed_features_rollout = [
          'Phase 1 (Weeks 1–2): Seed 5–10 instructors; launch 1 live cohort; enable certificates and refund policy',
          'Phase 2 (Weeks 3–4): Add community, office hours, and project reviews; publish outcomes',
          'Phase 3 (Weeks 5–8): Instructor analytics, verified credentials, and partnerships for employer visibility'
        ];
        (response as any).value_stack = [
          'Trust: verified instructors, certificates, refund guarantees',
          'Outcomes: projects, portfolios, and completion support',
          'Engagement: cohorts, office hours, community challenges',
          'Efficiency: discovery, curation, and creator tooling'
        ];
        (response as any).geo_plan_90_days = [
          'Weeks 1–2: pick a niche + 2 communities; seed 5–10 instructors and 200 learners on waitlist',
          'Weeks 3–4: run 1 cohort; collect testimonials and job-ready portfolios',
          'Weeks 5–8: expand to adjacent micro-niche; add scholarship partners and referrals',
          'Weeks 9–12: ship self-serve with quality bar; scale via creators and community partners'
        ];
      } else {
        (response as any).managed_features_rollout = [
          'Phase 1 (Weeks 1–2): Add escrow + structured briefs + QA review; publish guarantees',
          'Phase 2 (Weeks 3–4): Enable KYC/KYB and verified badges; add dispute resolution protocol',
          'Phase 3 (Weeks 5–8): Introduce role-based access, secure doc handling, and audit trails (regulated niches)'
        ];
        (response as any).value_stack = [
          'Trust: escrow, verification, guarantees',
          'Quality: structured briefs, QA, vetted talent',
          'Efficiency: niche matching, playbooks, ROI calculators',
          'Compliance: secure docs, audit trail, attestations (regulated)'
        ];
        (response as any).geo_plan_90_days = [
          'Weeks 1–2: pick city + ICP; seed 10–20 suppliers and 50 buyers',
          'Weeks 3–4: run local event/webinar; land 5–10 matches under escrow',
          'Weeks 5–8: feature top projects; introduce memberships and referrals',
          'Weeks 9–12: expand to adjacent micro-vertical or second borough'
        ];
      }

      // A compact text version for quick rendering
      const lines: string[] = [];
      lines.push(headline);
      if (whyLines.length) {
        lines.push('Why?');
        for (const w of whyLines) lines.push(`- ${w}`);
      }
      lines.push('Good news:');
      lines.push(`- ${goodNews}`);
      lines.push('Immediate action:');
      for (const a of immediateActions) lines.push(`• ${a}`);
      lines.push('Platform guidance:');
      let idx = 1; for (const p of platformGuidance) { lines.push(`${idx}. ${p}`); idx += 1; }
      (response as any).summary_text = lines.join('\n');

      // Key Insights: category-specific, analysis-only (no pivots), especially for PM
      try {
        const showPM = detectedCategoryKey === 'pm-software';
        if (showPM) {
          const comps = Array.isArray(majorCompetitors) ? majorCompetitors : [];
          const top3 = comps.slice(0, 3).map((comp: {name: string} | string) => 
            typeof comp === 'string' ? comp : comp.name).join(', ');
          const cac = Array.isArray(avgCACRange) ? `$${avgCACRange[0]}–$${avgCACRange[1]}` : '$400–$800';
          const price = Number(hybridInput?.price_point || 29);
          const insights = [
            `Market Saturation: ${saturationOut}%${top3 ? ` — dominated by ${top3}` : ''}`,
            `Economic Reality: New entrants face ${cac} CAC vs $${price}/month pricing = poor unit economics`,
            'Differentiation Gap: Generic features (task tracking, integrations) offer no competitive advantage',
            'Success Rate: <5% for generic PM tools launched post-2020'
          ];
          if (economicsExplanation) insights.push(String(economicsExplanation));
          (response as any).key_insights = insights;
          (response as any).key_insights_text = insights.join('\n');
        }
      } catch {}

      // Personalization: detect mismatch between stated challenge and detected category
      try {
        const statedChallenge = (
          (typeof (additionalFields as any)?.biggest_challenge === 'string' && (additionalFields as any).biggest_challenge) ||
          (typeof (additionalFields as any)?.challenge === 'string' && (additionalFields as any).challenge) ||
          (typeof (additionalFields as any)?.primary_challenge === 'string' && (additionalFields as any).primary_challenge) ||
          undefined
        );
        const mismatch = statedChallenge && /website|branding/i.test(String(statedChallenge)) && detectedCategoryKey === 'pm-software';
        if (mismatch) {
          (response as any).personalization_notes = [
            `You noted your biggest challenge is "${String(statedChallenge)}", but this validation is for PM software. Consider focusing on that challenge (website/branding) or aligning the idea to it before further PM development.`,
          ];
        }
      } catch {}
    } catch {}

    // Improved Validation Summary (category-aware copy with thresholds and historical benchmark note)
    try {
      const isMarketplaceKey = (detectedCategoryKey === 'freelance-marketplace' || detectedCategoryKey === 'services-marketplace');
      const improved: any = {
        headline: `Your current idea scores ${overallScore100}/100 due to ${saturationOut >= 90 ? 'market saturation, solved problem, and high CAC' : 'current constraints in the market'}.`,
        pivots_recommended: isMarketplaceKey
          ? 'Strong pivots are recommended: launch in a creative vertical (e.g., packaging for Miami D2C brands; UX for healthtech in SF/Boston) and add managed features (escrow, QA, onboarding).'
          : (detectedCategoryKey === 'pm-software'
              ? 'Strong pivots are recommended: verticalize one painful workflow (e.g., construction change orders) and prove ROI with 1–2 paid pilots.'
              : 'Strong pivots are recommended: specialize by industry/use-case and prove measurable ROI with a design partner.'),
        next_steps: [
          isMarketplaceKey ? 'Run a landing page experiment in one niche/city.' : 'Launch a focused landing page for one vertical workflow.',
          isMarketplaceKey ? 'Test managed workflows (escrow, structured briefs, QA, concierge onboarding) with real clients.' : 'Run a paid pilot and measure ROI (activation, time saved).',
          'Track demand, reduce leakage where relevant, and rescore segment-by-segment.'
        ],
        threshold: 'If you see >20% increase in signup and reduced leakage, demand and economics will climb, making your idea competitive (score >35/100).',
        historical_benchmark: 'Historical benchmarks show leaders scored 70%+ after pivoting to tightly focused, managed verticals.'
      };
      (response as any).summary_improved = improved;
      const t: string[] = [];
      t.push(improved.headline);
      t.push('Strong pivots are recommended:');
      t.push(`- ${isMarketplaceKey ? 'Launch in a creative vertical (packaging for Miami D2C brands; UX for healthtech).' : 'Verticalize one workflow and prove ROI with pilots.'}`);
      t.push(`- ${isMarketplaceKey ? 'Add managed features (escrow, QA, onboarding) to boost retention and trust.' : 'Build migration/ROI proof and industry integrations.'}`);
      t.push('What to do next:');
      for (const s of improved.next_steps) t.push(`• ${s}`);
      t.push(improved.threshold);
      t.push(improved.historical_benchmark);
      (response as any).summary_improved_text = t.join('\n');

      // Backtesting & progress visualization scaffold
      (response as any).backtesting = {
        weekly_series_template: [15, 18, 22, 27, 33, 40],
        probability_to_million: {
          baseline_arr_or_gmv_pct: isProjectManagement || isGenericMarketplace ? 10 : 12,
          post_pivot_projection_pct: 20
        },
        rescore_instruction: 'Run one cohort experiment per week and rescore. Track gains and compare to the template.'
      };
      (response as any).automation_suggestions = [
        'Auto-generate a landing page for the recommended niche (pull copy from value_prop)',
        'Create a survey with the top JTBD and pain hypotheses; route results back into scoring',
        'Spin up a prototype flow (structured briefs + escrow) to validate managed features'
      ];
      (response as any).data_sources_live = [
        'PitchBook/Crunchbase (competitor funding/valuations)',
        'SaaS benchmarks (CAC/LTV, churn, payback)',
        'Category reports for TAM/CAGR (via provider integration)'
      ];
    } catch {}

    // Structured "Validation Output Assessment" block for UI
    try {
      const sc = (response as any).scores || {};
      const bench = (response as any).market_intelligence?.benchmarkComparison?.typicalSuccessRange || [65, 85];
      const topCompetitors = Array.isArray(majorCompetitors) ? majorCompetitors.slice(0, 3) : [];
      const cacRange = Array.isArray(avgCACRange) ? avgCACRange : (isGenericMarketplace || isCreativeMarketplace ? [600, 1200] : undefined);
      // Pull expected time to profitability if available in riskAnalysis
      let timeToProfitMonths: number | undefined = undefined;
      try {
        const ra = (response as any).market_intelligence?.riskAnalysis;
        if (ra && typeof ra.expectedTimeToProfitabilityMonths === 'number') {
          timeToProfitMonths = ra.expectedTimeToProfitabilityMonths;
        }
      } catch {}

      const whyCapped: string[] = [];
      if (saturationOut >= 90) {
        whyCapped.push(`Market saturation: ${saturationOut}%${topCompetitors.length ? ` (${topCompetitors.map((comp: {name: string} | string) => 
          typeof comp === 'string' ? comp : comp.name).join(', ')} dominate)` : ''}`);
      }
      if (Number(sc.demand_signals) <= 10) {
        whyCapped.push('Low demand: too many solutions, not enough new pain identified');
      }
      if (cacRange) {
        whyCapped.push(`Economics: CAC of $${cacRange[0]}–$${cacRange[1]}, disintermediation and platform lock-in risks`);
      } else if (economicsExplanation) {
        whyCapped.push(String(economicsExplanation));
      }
      if (typeof timeToProfitMonths === 'number') {
        whyCapped.push(`Time to profitability: ${timeToProfitMonths}+ months (industry estimate)`);
      }

      (response as any).assessment = {
        title: 'Validation Output Assessment',
        score_summary: {
          overall: sc.overall,
          components: {
            problem: sc.problem,
            underserved: sc.underserved,
            demand: sc.demand_signals,
            differentiation: sc.differentiation,
            gtm: sc.gtm,
            economics: sc.wtp
          },
          benchmark_top_ideas: bench
        },
        why_capped: whyCapped,
        show_gap_visualization: true,
        where_you_land_if_pivot: (response as any)?.opportunities?.what_if?.estimated_scores?.overall
      };

      // Comparative benchmarks and motivational guidance
      const midpoint = Array.isArray(bench) ? Math.round(((bench[0] || 65) + (bench[1] || 85)) / 2) : 75;
      (response as any).benchmarks_comparison = {
        current_category_score: Number(sc.overall || 0),
        successful_verticals_score: midpoint,
        note: `Top ideas typically land between ${bench[0]}–${bench[1]} after early traction.`,
        side_by_side: [
          { label: 'You now', value: Number(sc.overall || 0) },
          { label: 'Successful verticals', value: midpoint }
        ]
      };

      // Strengths summary and motivation
      const strengths: string[] = [];
      try {
        const fitAvg = Number(sc.problem || 0) + Number(sc.demand_signals || 0);
        const growthAvg = Number(sc.differentiation || 0) + Number(sc.gtm || 0);
        if (growthAvg >= fitAvg) strengths.push('Your differentiation and GTM are above average — use this advantage to win in a managed, vertical niche.');
      } catch {}
      (response as any).strengths_summary = strengths;
      (response as any).motivation = [
        'Scoring low in saturated markets is common — what counts is how you pivot and validate in tighter verticals.',
        'Use explicit experiments and weekly rescoring to visualize progress into the 65–85 success band.'
      ];

      // Milestones and per-dimension progress targets
      // Use DTC subscription commerce milestones for physical subscription ideas (e.g., coffee box)
      const isPhysicalDNA = String((result as any)?.business_dna?.businessModel || '').toLowerCase() === 'physical-subscription';
      if (isPhysicalSubscription || isPhysicalDNA) {
        (response as any).milestones = [
          'Launch waitlist + presale: collect 100 signups and 20 paid presales; validate pricing and variety preferences.',
          'First-box satisfaction: ≥85% thumbs‑up/NPS≥30 within 7 days; track delivery issues and replacements.',
          'Pause/resume insights: ≤12% pause rate in first 60 days; add easy skip tools and “surprise & delight” inserts.',
          'Seasonal retention: ≥70% 3‑month retention through holidays/summer; plan promo bundles and gift spikes.',
          'Unit economics checkpoint: gross margin ≥55%, CAC payback <6 months, LTV:CAC ≥3.'
        ];
      } else if (detectedCategoryKey === 'learning-marketplace') {
        (response as any).milestones = [
          'Seed instructors: onboard 5–10 credible creators with proof of outcomes and a quality bar.',
          'Cohort launch: run 1–2 live cohorts; target completion ≥70% and NPS ≥40.',
          'Trust & outcomes: ship verified certificates, portfolio projects, and clear refund policy (<10% refunds).',
          'Liquidity: reach 200–300 learners on waitlist and 50+ active in first month; grow supply:demand ratio carefully.',
          'Economics: aim for 20–30% take‑rate on GMV with low leakage; validate LTV:CAC ≥3.'
        ];
      } else {
        (response as any).milestones = [
          'Landing page: 2 weeks targeting one city/vertical; goal: 25 qualified signups.',
          'Managed pilot: 10 engagements under escrow with <15% leakage; track retention.',
          'Paid pilots: 1–2 at target price; capture ROI evidence (time saved, activation).'
        ];
      }
      (response as any).progress_targets = {
        problem: { current: sc.problem, target: Math.min(60, Number(sc.problem || 0) + 15), note: 'Tighten ICP and outcomes' },
        underserved: { current: sc.underserved, target: Math.min(60, Number(sc.underserved || 0) + 20), note: 'Reduce saturation via niche + managed' },
        demand: { current: sc.demand_signals, target: Math.min(50, Math.round(Number(sc.demand_signals || 0) * 2)), note: 'Aim for >20% signup rate' },
        gtm: { current: sc.gtm, target: Math.min(70, Number(sc.gtm || 0) + 10), note: 'Lean into channels that already work' },
        economics: { current: sc.wtp, target: Math.min(60, Number(sc.wtp || 0) + 15), note: 'Decrease leakage; validate pricing' }
      } as const;

      // Optional inspirational success snapshots (placeholders)
      if (isPhysicalSubscription || isPhysicalDNA) {
        (response as any).success_stories = [
          'A coffee subscription raised first‑box satisfaction to 90% and achieved 72% 3‑month retention after adding a taste quiz and pause/skip/swap.',
          'A tea sampler box improved gross margin to 58% and reached CAC payback in 5 months by optimizing COGS and gifting bundles.'
        ];
      } else {
        (response as any).success_stories = [
          'A vertical PM tool focused on construction change orders and improved to 72/100 in 90 days.',
          'A creative marketplace launched in one city with escrow/QA and lifted to 68/100 after 10 managed engagements.'
        ];
      }

      // Platform playbook: anti-leakage, trust, and community features
      const playbook: string[] = [];
      if (detectedCategoryKey === 'learning-marketplace') {
        playbook.push(
          'Cohort engine: live sessions, office hours, and community to drive completion and outcomes',
          'Verified certificates, instructor credentials, and portfolio projects',
          'Creator tooling: analytics, feedback loops, and monetization features',
          'Refund policy and quality gates to build trust and reduce churn/refunds'
        );
      } else if (detectedCategoryKey === 'freelance-marketplace' || detectedCategoryKey === 'services-marketplace') {
        playbook.push(
          'Escrow with milestone-based payouts and dispute resolution',
          'Structured briefs and QA review steps to ensure quality and reduce churn',
          'KYB/KYC for buyers/sellers; verified badges and reputation scores',
          'Tiered memberships with perks for top performers and loyal buyers',
          'Community layer: curated intros, local meetups, spotlight features',
          'Secure document exchange, NDAs, and compliance where applicable',
          'Guarantee mechanisms (service-level guarantees, refund policies)'
        );
      } else if (detectedCategoryKey === 'regulated-services') {
        playbook.push(
          'Secure document handling with audit trails and access logs',
          'Compliance checklists (SOC 2, HIPAA, GDPR) and signed attestations',
          'Identity verification (KYC/KYB) and AML screening where required',
          'Escrow with milestone-based release and dispute resolution protocols',
          'Professional indemnity coverage options and guarantee mechanisms',
          'Role-based access control and data retention policies',
          'Reputation system for verified experts with industry credentials'
        );
      } else if (detectedCategoryKey === 'vertical-comms') {
        playbook.push(
          'Vertical-only integrations (EHR/EMR for clinics, property management CRMs, legal practice tools).',
          'Compliance automation for the vertical (e.g., HIPAA BAAs, audit logs, access controls).',
          'One-click reporting/dashboards specific to the vertical (e.g., insurance broker reports).',
          'Templates/playbooks for the wedge workflow and partnerships with local associations/meetups.'
        );
      } else if (detectedCategoryKey === 'pm-software') {
        playbook.push(
          'Vertical-specific integrations and templates (own one workflow deeply)',
          'Migration tooling and ROI calculators to justify switching',
          'Customer success playbook and implementation guides',
          'Pilot-to-contract motion with clear SLAs and success criteria'
        );
      }
      if (playbook.length) {
        (response as any).platform_playbook = playbook;
      }

      // Compact text version of the assessment
      const alines: string[] = [];
      alines.push('Analysis Check & Key Recommendations');
      alines.push('Validation Output Assessment');
      alines.push('Score Summary');
      alines.push('');
      alines.push(`Final overall: ${sc.overall}/100${saturationOut >= 90 ? ' (capped due to solved market, high saturation, and weak demand)' : ''}`);
      alines.push('');
      alines.push(`Problem: ${sc.problem}/100`);
      alines.push(`Underserved: ${sc.underserved}/100`);
      alines.push(`Demand: ${sc.demand_signals}/100`);
      alines.push(`Differentiation: ${sc.differentiation}/100`);
      alines.push(`GTM: ${sc.gtm}/100`);
      alines.push(`Economics: ${sc.wtp}/100`);
      alines.push('');
      alines.push(`Benchmark: Top ideas: ${bench[0]}–${bench[1]}/100`);
      alines.push('');
      alines.push('Why the score is capped:');
      for (const w of whyCapped) alines.push(`- ${w}`);
      (response as any).assessment_text = alines.join('\n');
    } catch {}

    // UI hints to accelerate front-end wiring (optional)
    try {
      (response as any).ui_hints = {
        sections: [
          { key: 'summary_improved', label: 'Improved Summary', type: 'text-block', source: 'summary_improved_text' },
          { key: 'assessment', label: 'Assessment', type: 'key-values', source: 'assessment.score_summary.components' },
          { key: 'key_insights', label: 'Key Insights', type: 'bullets', source: 'key_insights' },
          { key: 'progress', label: 'Path to Success', type: 'progress', source: 'market_intelligence.visualization.progress' },
          { key: 'segment_deltas', label: 'Projected Lift', type: 'delta-list', source: 'opportunities.what_if.segment_deltas' },
          { key: 'comparative', label: 'Benchmarks', type: 'comparison', source: 'benchmarks_comparison' },
          { key: 'motivation', label: 'Motivation', type: 'bullets', source: 'motivation' },
          { key: 'milestones', label: 'Milestones', type: 'bullets', source: 'milestones' },
          { key: 'targets', label: 'Per-dimension Targets', type: 'key-values', source: 'progress_targets' },
          { key: 'platform_loyalty', label: 'Anti-leakage', type: 'bullets', source: 'platform_loyalty' }
        ],
        components: {
          progress: { currentKey: 'current', targetKey: 'band.from', projectedKey: 'projected' },
          comparison: { leftKey: 'current_category_score', rightKey: 'successful_verticals_score', noteKey: 'note' },
          delta: { fields: ['dimension', 'from', 'to', 'delta', 'reason'] }
        }
      };
    } catch {}

    // Persist to KV for short-term retrieval; this enables /results/:id without requiring DB
    try {
      const kv = getKV();
      await kv.set(`validation:result:${responseId}`, response, { ex: 60 * 60 * 24 }); // 24h TTL
      (response as any).persisted = true;
      (response as any).persistence = 'kv';
    } catch {
      // non-fatal
    }

    return res.status(200).json(response);
  } catch (error: unknown) {
    console.error('Fixed validation API error:', error);
    return res.status(500).json({ 
      error: 'Validation failed', 
      details: (error && typeof error === 'object' && 'message' in error && typeof (error as { message?: unknown }).message === 'string')
        ? (error as { message: string }).message
        : 'Unknown error'
    });
  }
}

export default withValidation(handler as unknown as (req: SanitizedRequest, res: NextApiResponse) => Promise<void> | void);

// API route config: strict body size to limit abuse
export const config = {
  api: {
    bodyParser: {
      sizeLimit: '32kb',
    },
    externalResolver: false,
  },
};