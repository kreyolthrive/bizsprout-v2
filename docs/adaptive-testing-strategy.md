# Adaptive testing strategy for validation logic

This strategy ensures robust handling of edge cases and hybrid models via boundary value analysis, equivalence partitioning, and scenario-based testing. It complements the adaptive engine and the dynamic rules runtime.

## Test design techniques

- Boundary value analysis (BVA)
  - Stress extremes for each dimension: demand/economics/problem at 0, gate thresholds, and 10
  - Saturation at 0%, 89%, 90%, 100% (to verify caps around marketplace saturation)
  - CAC payback: <6m, 6–12m, >18m bins

- Equivalence partitioning (EP)
  - Partition by business model archetype: SaaS, physical-subscription, dtc-ecom, services/learning marketplace, regulated
  - Partition by regulatory level: none, moderate, heavy
  - Partition by channel: B2B vs B2C

- Scenario-based testing (SBT)
  - Narrative-based inputs spanning early-signal to traction scenarios
  - Marketplace supply-demand imbalance; disintermediation pressure
  - Regulated pathway variants (self-service vs supervised)

## Hybrid and edge models

- Sequential validation of components
  - Decompose hybrids (e.g., SaaS + marketplace + regulated) into components
  - Validate each with its framework; then run integration validation for interactions (pricing, risk, ops)

- Integration validation
  - Cross-constraints: regulatory risk raising caps on economics, saturation reducing overall
  - Rule engine effects: flags moving dimensions to review/fail; ensure UI reflects adaptive snapshot

## Minimal test plan template

- Inputs
  - text, hints (businessModel/category/flags), evidence metrics
- Expected
  - model classification, adaptive snapshot (weights, gates, caps), flags, UI hints
- Checks
  - Gate thresholds trip at exact boundaries
  - Caps engage at specified saturations
  - Rules produce expected flags/actions across partitions

## Tooling notes

- Use the existing TypeScript unit harness (if added) or quick runners under `scripts/`
- Favor deterministic seeds when randomization is involved (Monte Carlo)
- Log key assertions via `logger` with structured events for QA traceability
