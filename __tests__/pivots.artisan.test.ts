import { detectBusinessModelWithPriority, generateBusinessModelAwarePivots, BusinessModelType } from '@/lib/contextualPivots';

describe('Artisan physical product pivot relevance', () => {
  const idea = 'Handmade premium leather bags and wallets crafted by local artisans sold online and wholesale';
  const model = detectBusinessModelWithPriority(idea);

  it('classifies as physical product', () => {
    expect(model.primaryType).toBe(BusinessModelType.PHYSICAL_PRODUCT);
  });

  it('excludes fintech & healthcare pivots', () => {
    const pivots = generateBusinessModelAwarePivots({
      originalIdea: idea,
      currentScore: 40,
      businessModel: model,
      userProfile: { skills: [], interests: [], experience: [] }
    });
    const labels = pivots.map(p => p.option.label.toLowerCase());
    for (const bad of ['clinic','therapy','patient','health','fintech','payment','lending','bank']) {
      expect(labels.some(l => l.includes(bad))).toBe(false);
    }
  });

  it('includes at least one artisan-specific pivot', () => {
    const pivots = generateBusinessModelAwarePivots({
      originalIdea: idea,
      currentScore: 40,
      businessModel: model,
      userProfile: { skills: [], interests: [], experience: [] }
    });
    const ids = pivots.map(p => p.option.id);
    expect(ids.some(id => id.startsWith('physical.') || id.includes('artisan'))).toBe(true);
  });
});
