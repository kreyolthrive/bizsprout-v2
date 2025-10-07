import { test, expect } from '@playwright/test';
import { generateBusinessModelAwarePivots, BusinessModelType, BusinessModelClassification } from '@/lib/contextualPivots';

test.describe('Artisan filtering still applies on misclassification', () => {
  const idea = 'Handmade bespoke leather wallets and bags crafted by local artisans for eco conscious buyers';

  // Simulate a misclassification (e.g., services) while idea text is artisan physical goods
  const misclassified: BusinessModelClassification = {
    primaryType: BusinessModelType.SERVICES,
    confidence: 0.42,
    indicators: ['fallback classification'],
    constraints: ['market saturation'],
    reasoningChain: ['forced test misclassification']
  };

  test('excludes regulated sectors even if misclassified', () => {
    const pivots = generateBusinessModelAwarePivots({
      originalIdea: idea,
      currentScore: 35,
      businessModel: misclassified,
      userProfile: { skills: [], interests: [], experience: [] }
    });
    const labels = pivots.map(p => p.option.label.toLowerCase());
    for (const bad of ['clinic','therapy','patient','health','fintech','payment','lending','bank']) {
      expect(labels.some(l => l.includes(bad))).toBeFalsy();
    }
  });
});
