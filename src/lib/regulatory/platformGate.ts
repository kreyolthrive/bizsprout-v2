// src/lib/regulatory/platformGate.ts
import type { RegulatoryGateResult, RegulatoryFinding } from '@/types/validation';

export type PlatformPolicy = {
  platform: 'APP_STORE' | 'PLAY_STORE' | 'STRIPE' | 'PAYPAL' | 'GOOGLE_ADS' | 'FACEBOOK_ADS' | 'AMAZON_ADS';
  pattern: RegExp;
  violation: string;
  severity: 'BLOCKER' | 'HIGH' | 'MEDIUM';
  policy_link: string;
};

export const PLATFORM_POLICIES: PlatformPolicy[] = [
  // App Store / Play Store
  {
    platform: 'APP_STORE',
    pattern: /\b(sell|broker|marketplace).{0,15}personal data\b/i,
    violation: 'Sale of personal data prohibited',
    severity: 'BLOCKER',
    policy_link: 'https://developer.apple.com/app-store/review/guidelines/#privacy'
  },
  {
    platform: 'PLAY_STORE',
    pattern: /\b(surveillance|spy|track).{0,15}(without consent|secretly)\b/i,
    violation: 'Surveillance apps prohibited',
    severity: 'BLOCKER',
    policy_link: 'https://support.google.com/googleplay/android-developer/answer/9888379'
  },
  {
    platform: 'APP_STORE',
    pattern: /\b(children|kids|under 13).{0,30}(data|personal info|tracking)\b/i,
    violation: 'Children\'s data collection restrictions',
    severity: 'HIGH',
    policy_link: 'https://developer.apple.com/app-store/review/guidelines/#kids-category'
  },
  
  // Payment processors
  {
    platform: 'STRIPE',
    pattern: /\b(adult|escort|dating|gambling|cbd|crypto|high risk)\b/i,
    violation: 'Restricted business category',
    severity: 'HIGH',
    policy_link: 'https://stripe.com/restricted-businesses'
  },
  {
    platform: 'PAYPAL',
    pattern: /\b(weapons|tobacco|prescription|debt collection)\b/i,
    violation: 'Prohibited business activity',
    severity: 'BLOCKER',
    policy_link: 'https://www.paypal.com/us/webapps/mpp/ua/acceptableuse-full'
  },
  
  // Advertising platforms
  {
    platform: 'GOOGLE_ADS',
    pattern: /\b(misleading|fake|scam|get rich quick)\b/i,
    violation: 'Misleading content policy violation',
    severity: 'HIGH',
    policy_link: 'https://support.google.com/adspolicy/answer/6020955'
  },
  {
    platform: 'FACEBOOK_ADS',
    pattern: /\b(before.{0,10}after|weight loss|miracle|guaranteed results)\b/i,
    violation: 'Health/weight loss claims restrictions',
    severity: 'MEDIUM',
    policy_link: 'https://www.facebook.com/policies/ads/prohibited_content/health'
  },
  {
    platform: 'AMAZON_ADS',
    pattern: /\b(counterfeit|replica|knockoff|unauthorized)\b/i,
    violation: 'Intellectual property violations',
    severity: 'BLOCKER',
    policy_link: 'https://advertising.amazon.com/policies/prohibited-content'
  }
];

export async function runPlatformPolicyGate(input: {
  idea_text: string;
  target_platforms?: string[];
}): Promise<RegulatoryGateResult> {
  const text = input.idea_text || '';
  const targetPlatforms = input.target_platforms || [];
  
  const violations: RegulatoryFinding[] = [];
  let hasBlocker = false;
  let hasHigh = false;

  // Check against all platform policies
  for (const policy of PLATFORM_POLICIES) {
    if (policy.pattern.test(text)) {
      // If user specified target platforms, only flag relevant ones
      if (targetPlatforms.length > 0 && !targetPlatforms.includes(policy.platform)) {
        continue;
      }

      violations.push({
        jurisdiction: 'US', // Most platforms are US-based
        severity: policy.severity,
        statutes: [`${policy.platform} Terms of Service`],
        issues: [policy.violation],
        notes: `Platform policy violation detected. Review: ${policy.policy_link}`,
        estimated_costs: policy.severity === 'BLOCKER' ? [
          { line_item: 'Business model pivot', range_usd: [10_000, 50_000] },
          { line_item: 'Alternative platform integration', range_usd: [5_000, 25_000] }
        ] : undefined
      });

      if (policy.severity === 'BLOCKER') hasBlocker = true;
      if (policy.severity === 'HIGH') hasHigh = true;
    }
  }

  // Determine overall status
  let status: 'PASS' | 'REVIEW' | 'FAIL' = 'PASS';
  let headline = 'No platform policy conflicts detected';
  let recommendation: 'DO_NOT_PROCEED' | 'PIVOT_TO_COMPLIANT' | 'CONSULT_COUNSEL' = 'PIVOT_TO_COMPLIANT';

  if (hasBlocker) {
    status = 'FAIL';
    headline = 'Critical platform policy violations detected';
    recommendation = 'DO_NOT_PROCEED';
  } else if (hasHigh || violations.length > 0) {
    status = 'REVIEW';
    headline = 'Potential platform policy conflicts require review';
    recommendation = 'CONSULT_COUNSEL';
  }

  // Generate suggested pivots for blocked ideas
  const suggested_pivots: string[] = [];
  if (hasBlocker) {
    if (violations.some(v => v.issues.includes('Sale of personal data prohibited'))) {
      suggested_pivots.push(
        'Anonymous analytics and insights (no personal data)',
        'Opt-in research panel with clear consent',
        'B2B market intelligence without individual tracking'
      );
    }
    if (violations.some(v => v.issues.includes('Restricted business category'))) {
      suggested_pivots.push(
        'Adjacent compliant business model',
        'B2B services to compliant businesses',
        'Educational/informational platform'
      );
    }
  }

  return {
    status,
    headline,
    findings: violations,
    recommendation,
    suggested_pivots: suggested_pivots.length > 0 ? suggested_pivots : undefined
  };
}
