import { test, expect } from '@playwright/test';
import { detectBusinessModelWithPriority, generateBusinessModelAwarePivots, BusinessModelType } from '@/lib/contextualPivots';

// These functions are pure; we can invoke them directly in a unit-style Playwright test.

test.describe('Artisan physical product pivot relevance', () => {
  const idea = 'Handmade premium leather bags and wallets crafted by local artisans sold online and wholesale';

  test('classifies as physical product', () => {
    const model = detectBusinessModelWithPriority(idea);
    expect(model.primaryType).toBe(BusinessModelType.PHYSICAL_PRODUCT);
  });

  test('excludes fintech & healthcare pivots', () => {
    const model = detectBusinessModelWithPriority(idea);
    const pivots = generateBusinessModelAwarePivots({
      originalIdea: idea,
      currentScore: 40,
      businessModel: model,
      userProfile: { skills: [], interests: [], experience: [] }
    });
    const labels = pivots.map(p => p.option.label.toLowerCase());
    for (const bad of ['clinic','therapy','patient','health','fintech','payment','lending','bank']) {
      expect(labels.some(l => l.includes(bad))).toBeFalsy();
    }
  });

  test('includes at least one artisan-specific pivot', () => {
    const model = detectBusinessModelWithPriority(idea);
    const pivots = generateBusinessModelAwarePivots({
      originalIdea: idea,
      currentScore: 40,
      businessModel: model,
      userProfile: { skills: [], interests: [], experience: [] }
    });
    const ids = pivots.map(p => p.option.id);
    expect(ids.some(id => id.startsWith('physical.') || id.includes('artisan'))).toBeTruthy();
  });
});
