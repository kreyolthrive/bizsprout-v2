# Dynamic Business Validation Framework

A practical architecture for adaptive validation across diverse business models.

## Why adaptive validation?

Static validation frameworks violate contingency theory: success conditions depend on business model, industry structure, and operational complexity. Research (MIT Sloan, HBS) and practice (Airbnb, Slack, PayPal) show adaptive validation enables timely pivots and better odds.

## Design goals

- Model-aware: weights, gates, and caps adapt by business model and saturation.
- Transparent: expose weights, gate violations, and caps to the UI.
- Minimal coupling: pure TS helpers, no external deps.
- Backward compatible: attaches to existing API output without breaking the UI.

## Core concepts

- BusinessModelKey: saas-b2b, saas-b2c, physical-subscription, dtc-ecom, services-marketplace, freelance-marketplace, learning-marketplace, regulated-services, vertical-comms, pm-software, general.
- Dimensions: problem, underserved, demand, differentiation, economics, gtm (each 0–10 in core engine; UI remains 0–100 after scaling).
- Weights: per-model matrices (sum to 1); can accept custom overrides and normalize.
- Gates: minimum thresholds per dimension and optional saturation cap for overall.
- Caps: apply marketplace/PM caps when saturation ≥ 90 to keep outcomes realistic.

## Math sketch

Let d = {problem, underserved, demand, differentiation, economics, gtm} ∈ [0,10]^6.
Let w(model) be the selected weight vector such that ∑ w_i = 1.
Overall_10 = ∑ d_i * w_i.
Overall_100_pre_caps = round(Overall_10 × 10).
If saturation ≥ 90 and model has a saturationCapOverall100, Overall_100_post = min(Overall_100_pre_caps, cap); else unchanged.

Gates: if any d_i < threshold_i, record violation with reason; UI can display and recommend actions.

## Implementation

- Library: `src/lib/adaptiveValidation.ts`
  - `DEFAULT_WEIGHTS`, `DEFAULT_GATES`, `evaluateAdaptive`, `chooseWeights`, `inferModelFromHints`.
- API integration: `pages/api/validate.ts`
  - Computes an adaptive snapshot and attaches `adaptive_validation` to the response alongside existing math.

## Extending

- Add a new business model: extend `BusinessModelKey`, define weights and gates.
- Tune for a vertical: pass lightweight custom weight overrides to `chooseWeights` (future hook).
- Add a cap: extend gates with additional cap fields and update `evaluateAdaptive` accordingly.

## Validation workflow

1. Detect business model and category (existing classifier + hints).
2. Select weights/gates; compute overall and gate violations.
3. Apply caps based on saturation and model.
4. Surface guidance and experiments tailored to model (existing logic + per-model content).

## Notes

- This is intentionally minimal to avoid refactors; future work could fully unify the API’s scoring with this engine.

See also: `docs/dynamic-validation-math.md` for the theoretical/math foundations and simulation utilities.

For per-model validation requirements and metrics, see `docs/business-model-taxonomy.md`.

For delivery and change management, see `docs/implementation-methodology.md`.

For testing patterns across hybrids and edge cases, see `docs/adaptive-testing-strategy.md`.

For concrete differences in validation criteria by business type (B2B SaaS, B2C marketplace, FinTech, HealthTech), see `docs/validation-differentiation.md`.

For common pitfalls and risk mitigations (bias, TAM overestimation, static rules, edge cases, governance), see `docs/pitfalls-and-risk-mitigation.md`.

For the statistical methods and measurement plan (hypothesis tests, regressions, Monte Carlo, and success KPIs), see `docs/mathematical-rigor-and-metrics.md`.

For a high-level conclusion and a 12-month implementation roadmap with budget/ROI guidance, see `docs/conclusion-and-roadmap.md`.
