// Coherence Detection System

import { assessVagueness } from '@/lib/vagueness';

export type CoherenceIssueType = 'contradictory' | 'conflicting-models' | 'impossible-combination';

export interface CoherenceIssue {
  type: CoherenceIssueType;
  description: string;
  explanation: string;
  suggestions: string[];
}

export interface CoherenceAssessment {
  isCoherent: boolean;
  coherenceScore: number; // 0-100
  issues: CoherenceIssue[];
  detectedModels: string[];
}

const CONTRADICTORY_PATTERNS: Array<{ pattern: string[]; explanation: string; suggestion: string }> = [
  {
    pattern: ['one-time', 'saas'],
    explanation: 'SaaS (Software as a Service) is inherently subscription-based. One-time purchases are not SaaS.',
    suggestion: 'Clarify: Are you building (A) subscription SaaS software, or (B) one-time purchase software?'
  },
  {
    pattern: ['one-time', 'subscription'],
    explanation: 'You cannot have both one-time purchases and subscriptions as your primary business model.',
    suggestion: 'Choose one: (A) One-time license purchases, or (B) Recurring subscription revenue'
  },
  {
    pattern: ['free', 'premium', 'enterprise'],
    explanation: 'Combining free, premium, and enterprise pricing in one sentence suggests unclear target market.',
    suggestion: 'Specify your primary monetization: Freemium for consumers, or enterprise contracts for B2B?'
  },
  {
    pattern: ['marketplace', 'saas', 'platform'],
    explanation: 'Using marketplace, SaaS, and platform together indicates confusion about your business model.',
    suggestion: 'Pick the primary model: (A) Marketplace connecting buyers/sellers, (B) SaaS tool for one side, or (C) Platform with network effects'
  },
  {
    pattern: ['b2b', 'consumer'],
    explanation: 'B2B and consumer models require fundamentally different strategies, pricing, and sales approaches.',
    suggestion: 'Choose your customer: (A) Businesses (B2B), or (B) Individual consumers (B2C)'
  }
];

const BUSINESS_MODEL_KEYWORDS: Record<string, string[]> = {
  marketplace: ['marketplace', 'commission', 'two-sided', 'buyers and sellers', 'platform fee'],
  saas: ['saas', 'software as a service', 'subscription software', 'cloud software'],
  ecommerce: ['e-commerce', 'ecommerce', 'online store', 'sell products', 'shopping cart'],
  social: ['social network', 'social media', 'community platform', 'user-generated content'],
  consulting: ['consulting', 'advisory', 'professional services', 'done-for-you'],
  physical: ['physical product', 'manufacturing', 'inventory', 'ship products']
};

export function analyzeBusinessCoherence(ideaText: string): CoherenceAssessment {
  const text = (ideaText || '').toLowerCase();
  const issues: CoherenceIssue[] = [];

  // Contradictory patterns
  for (const { pattern, explanation, suggestion } of CONTRADICTORY_PATTERNS) {
    const hasAll = pattern.every((t) => text.includes(t));
    if (hasAll) {
      issues.push({
        type: 'contradictory',
        description: `Contradictory terms: "${pattern.join('" and "')}"`,
        explanation,
        suggestions: [suggestion]
      });
    }
  }

  // Detect models
  const detectedModels: string[] = [];
  for (const [model, keywords] of Object.entries(BUSINESS_MODEL_KEYWORDS)) {
    const hasModel = keywords.some((kw) => text.includes(kw));
    if (hasModel) detectedModels.push(model);
  }

  // Too many models
  if (detectedModels.length >= 3) {
    issues.push({
      type: 'conflicting-models',
      description: `Too many business models combined: ${detectedModels.join(', ')}`,
      explanation: `You're trying to combine ${detectedModels.length} different business models. Each requires fundamentally different strategies, operations, and go-to-market approaches.`,
      suggestions: [
        'Pick ONE primary business model to focus on',
        'If you need multiple models, explain which is primary and which is secondary',
        `Choose: ${detectedModels.map((m, i) => `(${String.fromCharCode(65 + i)}) ${m}`).join(', ')}`
      ]
    });
  }

  // Marketplace + SaaS without clarity
  if (detectedModels.includes('marketplace') && detectedModels.includes('saas')) {
    const hasClearPrimary = /\bprimarily\b|\bmainly\b|\bstarting with\b/.test(text);
    if (!hasClearPrimary) {
      issues.push({
        type: 'impossible-combination',
        description: 'Marketplace + SaaS without clarity on primary model',
        explanation: 'A marketplace connects buyers and sellers. SaaS provides software tools. These are fundamentally different value propositions.',
        suggestions: [
          'Are you building (A) a marketplace that happens to use software, or (B) SaaS software with a marketplace component?',
          'Example: "SaaS tool for freelancers, with a marketplace for finding clients as a secondary feature"'
        ]
      });
    }
  }

  const base = 100;
  const penaltyPer = 30;
  const coherenceScore = Math.max(0, base - issues.length * penaltyPer);

  return {
    isCoherent: coherenceScore >= 60,
    coherenceScore,
    issues,
    detectedModels
  };
}

export function comprehensiveIdeaValidation(ideaText: string): {
  passesValidation: boolean;
  vaguenessAssessment?: ReturnType<typeof assessVagueness>;
  coherenceAssessment?: CoherenceAssessment;
  blockingIssue: 'vagueness' | 'coherence' | null;
} {
  const v = assessVagueness(ideaText);
  if (v.isVague) return { passesValidation: false, vaguenessAssessment: v, blockingIssue: 'vagueness' };
  const c = analyzeBusinessCoherence(ideaText);
  if (!c.isCoherent) return { passesValidation: false, coherenceAssessment: c, blockingIssue: 'coherence' };
  return { passesValidation: true, blockingIssue: null };
}
