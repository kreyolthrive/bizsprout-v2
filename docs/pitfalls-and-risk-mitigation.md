# Common pitfalls and risk mitigation

This document lists pervasive pitfalls observed across failed startups and successful pivots, plus concrete mitigations implemented in this platform.

## Pitfall 1: Confirmation bias in validation

- Risk: Validators design tests that confirm existing beliefs; blind spots persist.
- Mitigations
  - Diverse stakeholder input (COPIS perspective); independent validation teams using “effective challenge” to question assumptions
  - Rule reviews with dissent protocol; A/B validation of competing hypotheses
  - Require counter-evidence collection in experiments (what would disconfirm this?)

## Pitfall 2: Market addressability (TAM/SAM/SOM) overestimation

- Risk: Financial projections skew from inflated addressable market assumptions.
- Mitigations
  - Triangulation: surveys, interviews, 3rd-party market data; require at least two independent sources
  - Saturation caps and demand gates; sensitivity and scenario analysis
  - Versioned assumptions with audit trail

## Pitfall 3: Static validation rules become obsolete

- Risk: Rules hard-coded; no path to evolve with market/business changes.
- Mitigations
  - JSON rule engine with hot updates via `/api/rules`; versioning and history log
  - Performance feedback loops: rules adjusted based on outcomes; review cadence
  - Canary rules + ramp plans

## Pitfall 4: Edge case coverage inadequacy

- Risk: Rare or extreme scenarios crash or invalidate results.
- Mitigations
  - Boundary value analysis and negative case testing; stress testing protocols
  - Concurrent load tests for simultaneous validations; graceful degradation paths
  - Fallback logic when ML services or external systems fail (circuit breaker)

## Pitfall 5: Data leakage and biased datasets

- Risk: Contaminated datasets produce misleading validations.
- Mitigations
  - Strict dataset versioning and lineage; holdout sets; periodic re-evaluation
  - Privacy and compliance scanning; least-privilege access control
  - Structured logging for audit and anomaly detection

## Pitfall 6: ML overfit or unavailability

- Risk: Overfit models fail in the wild; outages block validations.
- Mitigations
  - Heuristic-first classification; ML gated by confidence; use circuit breaker and caching
  - Rollback model versions; offline evaluation; monitor drift
  - Fallback to rules-only mode when ML is down

## Pitfall 7: Premature scaling and brittle ops

- Risk: Scaling before product/market fit; infrastructure fails under load.
- Mitigations
  - Stage-gated rollout; soak tests and game-days; SLOs with alerting
  - Chaos/resilience testing for breaker and timeouts
  - Capacity planning tied to model confidence and demand signals

## Pitfall 8: Governance gaps and missing audits

- Risk: Untracked changes and unclear ownership lead to regressions.
- Mitigations
  - Rules versioning with history (actor IP, timestamp); change approval workflow
  - Security reviews for integrations; periodic compliance checks
  - Post-mortems and blameless reviews; playbooks and training

## Where this shows up in the repo

- `/api/rules`: hot updates with Redis persistence; we’ll add history in the API
- `src/lib/adaptive/circuitBreaker.ts`: resilience wrapper for external dependencies
- `src/lib/adaptive/runtime.ts`: safe, constrained rules evaluator
- `src/lib/adaptive/policy.ts`: maps context to appropriate frameworks for targeted testing
- Docs: methodology, testing strategy, architecture, and differentiation guides
