export type CostBreakdown = Record<string, string>;

export type CostRange = {
  min: number;
  max: number;
  reasoning: string;
  breakdown: CostBreakdown;
};

export type CostModel = {
  mvp: CostRange;
  scale?: CostRange;
};

type CostDatabase = Record<string, CostModel>;

export type UnitEconomicsOptions = {
  churnRate?: number;
  grossMargin?: number;
  averageSeats?: number;
};

export type UnitEconomicsResult = {
  monthlyRevenue: number;
  ltv: number;
  paybackMonths: number;
  ltvCacRatio: number;
  isViable: boolean;
  warnings: string[];
  assumptions: Required<UnitEconomicsOptions> & { pricing: number; marketCAC: number };
};

const DEFAULT_CHURN_RATE = 0.15;
const DEFAULT_GROSS_MARGIN = 0.8;
const DEFAULT_SEATS = 5;

const BASE_COSTS: CostDatabase = {
  project_management_saas: {
    mvp: {
      min: 150_000,
      max: 300_000,
      reasoning: 'Need superior UX to compete with established players',
      breakdown: {
        'Development team (6-12 months)': '$80,000-$150,000',
        'Design & UX (critical for differentiation)': '$30,000-$60,000',
        'Infrastructure & security': '$20,000-$40,000',
        'Legal & compliance': '$10,000-$25,000',
        'Initial marketing': '$25,000-$50,000',
      },
    },
  },
};

function deepCloneCostModel(model: CostModel): CostModel {
  const cloneRange = (range?: CostRange): CostRange | undefined =>
    range
      ? {
          min: range.min,
          max: range.max,
          reasoning: range.reasoning,
          breakdown: { ...range.breakdown },
        }
      : undefined;

  return {
    mvp: cloneRange(model.mvp) as CostRange,
    ...(model.scale ? { scale: cloneRange(model.scale) } : {}),
  };
}

export class FinancialValidator {
  // Physical subscription (e.g., coffee boxes) unit economics helper
  // Inputs are simple and deterministic to avoid dependency on external providers
  static calculatePhysicalSubscriptionEconomics(
    pricingPerBox: number,
    cogs: {
      beansCost?: number; // coffee/contents cost per box
      packagingCost?: number;
      fulfillmentCost?: number; // pick/pack/label labor
      shippingCost?: number; // carrier cost after discounts
      otherCost?: number; // inserts, samples, extras
      breakageAllowancePct?: number; // waste/returns as % of revenue
    } = {},
    opts: { boxesPerMonth?: number; churnRate?: number; marketCAC?: number } = {}
  ) {
    const boxesPerMonth = Number.isFinite(opts.boxesPerMonth) && opts.boxesPerMonth! > 0 ? opts.boxesPerMonth! : 1;
    const churnRate = Number.isFinite(opts.churnRate) && opts.churnRate! > 0 ? opts.churnRate! : 0.08; // 8% monthly default
    const marketCAC = Number.isFinite(opts.marketCAC) && opts.marketCAC! > 0 ? opts.marketCAC! : 120; // typical DTC range $60-$180

    const beansCost = Number.isFinite(cogs.beansCost) ? Number(cogs.beansCost) : 6; // per 10-12oz bag wholesale
    const packagingCost = Number.isFinite(cogs.packagingCost) ? Number(cogs.packagingCost) : 1.2;
    const fulfillmentCost = Number.isFinite(cogs.fulfillmentCost) ? Number(cogs.fulfillmentCost) : 1.5;
    const shippingCost = Number.isFinite(cogs.shippingCost) ? Number(cogs.shippingCost) : 6.5; // blended ground w/ zones
    const otherCost = Number.isFinite(cogs.otherCost) ? Number(cogs.otherCost) : 0.8;
    const breakageAllowancePct = Number.isFinite(cogs.breakageAllowancePct)
      ? Math.max(0, Math.min(0.2, Number(cogs.breakageAllowancePct)))
      : 0.02; // 2%

    const cogsPerBox = beansCost + packagingCost + fulfillmentCost + shippingCost + otherCost;
    const revenuePerBox = pricingPerBox;
    const grossMarginPerBox = Math.max(0, revenuePerBox - cogsPerBox);
    const grossMarginPct = revenuePerBox > 0 ? grossMarginPerBox / revenuePerBox : 0;
    const breakageCost = revenuePerBox * breakageAllowancePct;
    const contributionPerBox = Math.max(0, grossMarginPerBox - breakageCost);
    const contributionPerMonth = contributionPerBox * boxesPerMonth;

    const paybackMonths = contributionPerMonth > 0 ? marketCAC / contributionPerMonth : Infinity;
    const ltv = churnRate > 0 ? contributionPerMonth / churnRate : Infinity;
    const ltvCacRatio = marketCAC > 0 ? ltv / marketCAC : 0;

    const warnings: string[] = [];
    if (grossMarginPct < 0.4) warnings.push('Gross margin below 40% is challenging for DTC subscriptions');
    if (!Number.isFinite(paybackMonths) || paybackMonths > 6) warnings.push('Payback over 6 months stresses cash flow and retention risk');
    if (shippingCost > 8) warnings.push('Shipping cost appears high; consider zone skipping, negotiated rates, or 3PLs');
    if (revenuePerBox < cogsPerBox) warnings.push('Price is below COGS — negative gross margin');

    const assumptions = {
      pricingPerBox: revenuePerBox,
      boxesPerMonth,
      churnRate,
      marketCAC,
      cogsPerBox: {
        beansCost,
        packagingCost,
        fulfillmentCost,
        shippingCost,
        otherCost,
        breakageAllowancePct,
      },
    } as const;

    return {
      grossMarginPct,
      cogsPerBox,
      contributionPerMonth,
      paybackMonths: Number.isFinite(paybackMonths) ? Math.round(paybackMonths * 10) / 10 : Infinity,
      ltv: Number.isFinite(ltv) ? Math.round(ltv) : Infinity,
      ltvCacRatio: Math.round(ltvCacRatio * 100) / 100,
      isViable: grossMarginPct >= 0.45 && paybackMonths <= 6,
      warnings,
      assumptions,
    };
  }
  static calculateRealisticCosts(
    businessType: keyof typeof BASE_COSTS,
    marketSaturation: number,
    competitors: number
  ): CostModel | null {
    const base = BASE_COSTS[businessType];
    if (!base) return null;

    const cloned = deepCloneCostModel(base);
    const adjustments: string[] = [];

    let minMultiplier = 1;
    let maxMultiplier = 1;

    if (marketSaturation > 90) {
      minMultiplier *= 1.5;
      maxMultiplier *= 2.0;
      adjustments.push('Extreme competition requires significant differentiation investment.');
    } else if (marketSaturation > 80) {
      minMultiplier *= 1.25;
      maxMultiplier *= 1.6;
      adjustments.push('High saturation raises acquisition and product expectations.');
    }

    if (competitors >= 10) {
      minMultiplier *= 1.2;
      maxMultiplier *= 1.4;
      adjustments.push('Crowded incumbent landscape demands deeper feature scope and marketing.');
    } else if (competitors >= 5) {
      minMultiplier *= 1.1;
      maxMultiplier *= 1.2;
      adjustments.push('Multiple incumbents force higher launch quality and GTM spend.');
    }

    const mvp = cloned.mvp;
    mvp.min = Math.round(mvp.min * minMultiplier);
    mvp.max = Math.round(mvp.max * maxMultiplier);
    if (adjustments.length) {
      const suffix = adjustments.join(' ');
      mvp.reasoning = `${mvp.reasoning}. ${suffix}`.trim();
    }

    if (cloned.scale) {
      cloned.scale.min = Math.round(cloned.scale.min * minMultiplier);
      cloned.scale.max = Math.round(cloned.scale.max * maxMultiplier);
      if (adjustments.length) {
        const suffix = adjustments.join(' ');
        cloned.scale.reasoning = `${cloned.scale.reasoning}. ${suffix}`.trim();
      }
    }

    return cloned;
  }

  static calculateUnitEconomics(
    pricing = 29,
    marketCAC = 1200,
    options: UnitEconomicsOptions = {}
  ): UnitEconomicsResult {
    const churnRate = Number.isFinite(options.churnRate) && options.churnRate! > 0 ? options.churnRate! : DEFAULT_CHURN_RATE;
    const grossMargin = Number.isFinite(options.grossMargin) && options.grossMargin! > 0 ? options.grossMargin! : DEFAULT_GROSS_MARGIN;
    const averageSeats = Number.isFinite(options.averageSeats) && options.averageSeats! > 0 ? options.averageSeats! : DEFAULT_SEATS;

    const monthlyRevenue = pricing * averageSeats;
    const contributionPerCustomer = monthlyRevenue * grossMargin;
    const paybackMonths = contributionPerCustomer > 0 ? marketCAC / contributionPerCustomer : Infinity;
    const ltv = churnRate > 0 ? (monthlyRevenue * grossMargin) / churnRate : Infinity;
    const ltvCacRatio = marketCAC > 0 ? ltv / marketCAC : 0;

    const warnings = this.generateEconomicsWarnings(paybackMonths, ltvCacRatio);
    const isViable = paybackMonths <= 24 && ltvCacRatio >= 3;

    return {
      monthlyRevenue: Math.round(monthlyRevenue),
      ltv: Math.round(ltv),
      paybackMonths: Math.round(paybackMonths),
      ltvCacRatio: Math.round(ltvCacRatio * 100) / 100,
      isViable,
      warnings,
      assumptions: {
        pricing,
        marketCAC,
        churnRate,
        grossMargin,
        averageSeats,
      },
    };
  }

  static generateEconomicsWarnings(paybackMonths: number, ratio: number): string[] {
    const warnings: string[] = [];
    if (!Number.isFinite(paybackMonths) || paybackMonths <= 0) {
      warnings.push('WARNING: Payback period is undefined due to missing or zero contribution margin.');
    } else if (paybackMonths > 24) {
      warnings.push(`CRITICAL: ${Math.round(paybackMonths)} month CAC payback exceeds viable 24-month threshold`);
    }
    if (!Number.isFinite(ratio) || ratio <= 0) {
      warnings.push('WARNING: LTV:CAC ratio is undefined; verify pricing, churn, and CAC inputs.');
    } else if (ratio < 3) {
      warnings.push(`WARNING: ${ratio.toFixed(2)}:1 LTV:CAC ratio below healthy 3:1 threshold`);
    }
    return warnings;
  }
}

export default FinancialValidator;
