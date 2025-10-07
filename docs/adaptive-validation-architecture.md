# Adaptive Validation Architecture

This document proposes a concrete, incremental architecture for an adaptive validation system that matches the repository’s conventions (Next.js + TypeScript, API in `pages/api`, core logic in `src/lib/*`). It reconciles ML-based model classification, a dynamic rules layer, and resilience patterns with the existing validation framework and adaptive engine.

## 1. Four-stage pipeline

1. Ingest & Normalize

- Inputs: idea description, metadata, early metrics (emails, CTR, signups), evidence attachments
- Normalize to a canonical shape (strings lowercased, tokens, numeric hints)

1. Classify Business Model

- Primary path (fast): heuristics and the existing `inferModelFromHints()`
- ML path (async or microservice): t-SNE + spectral clustering on feature embeddings to better separate non-convex clusters (marketplaces, physical subscription, regulated services)
- Output: `{ modelKey, confidence, features }`

1. Evaluate (Scores, Gates, Caps)

- Use existing `evaluateAdaptive(modelKey, hints)` to produce weights/gates/caps
- Apply domain calculators: DTC unit economics, marketplace take-rate math, saturation gates
- Optional uncertainty via `adaptiveSimulation` (Monte Carlo)

1. Synthesize & Surface

- Compose API payload: scores, flags, milestones, experiments, guidance, `adaptive_validation` snapshot
- Optional GraphQL facade for flexible querying; REST remains the default

## 2. Hexagonal architecture (ports & adapters)

Core domain services are wrapped by ports; adapters supply concrete implementations:

- ClassificationPort: wraps the heuristic classifier and an optional ML microservice
- RuleEnginePort: JSON-based rules runtime with safe evaluation (no untrusted code execution)
- ValidationPort: orchestrates scoring, gates, caps
- PersistencePort: Redis/Supabase for caching and history
- EventPort: emit structured logs and audit events
- ABTestPort: allocate traffic and track outcomes for rule variants
- CircuitBreaker: wrapper for remote calls (ML, rules service)

Ports live in `src/lib/adaptive/ports.ts`; adapters reside alongside existing libs (`src/lib/redis.ts`, `src/lib/db.ts`).

## 3. ML classification service (t‑SNE + Spectral)

- Training happens offline in Python (scikit-learn). We export centroids/affinities and a lightweight spectral-graph model for runtime.
- Runtime options:
  - On-box heuristic first; defer to ML via HTTP when confidence < threshold
  - Batch endpoints for async labeling; cache results
- Service resilience: circuit breaker + graceful degradation; fallback to heuristics when unavailable.

Why t‑SNE + spectral?

- t‑SNE preserves local neighborhoods for non-convex clusters; spectral clustering exploits graph structure for better separation than PCA + k-means on these domains.

## 4. Dynamic rules engine

- Rule definitions stored as JSON with a constrained expression language (no arbitrary JS). Example:

  ```json
  {
    "id": "dtc-margin-guard",
    "when": "model == 'physical-subscription' && margin_pct < 0.35",
    "then": [
      { "type": "flag", "code": "LOW_MARGIN" },
      { "type": "gate", "dimension": "economics", "action": "review" }
    ]
  }
  ```

- An in-repo runtime supports evaluation; hot-reload by updating Redis key or database row.
- External options for enterprise:
  - Microsoft RulesEngine (C#/.NET) with EF persistence
  - GoRules (Rust engine) for microsecond-scale evaluation
- This repo ships with the local runtime and ports that allow swapping implementations.

## 5. API surface (REST first, GraphQL optional)

REST endpoints (under `pages/api`):

- POST `/api/validate` – existing; include `adaptive_validation` snapshot
- GET `/api/rules` – list active rule sets (optional)
- POST `/api/rules` – upsert a rule set (guarded; optional)
- POST `/api/validate/batch` – accept array of inputs for offline processing (optional)

GraphQL (optional): expose the same domain via a simple schema if needed; otherwise defer.

## 6. Resilience and fallbacks

- Circuit breaker for external services (ML classifier, enterprise rule engines)
- Timeouts and graceful degradation: if ML or external rules fail, fallback to local heuristic classification and local rules runtime
- Rate limits and CORS per existing `rateLimit.ts` and ALLOW_ORIGIN

## 7. Incremental plan for this repo

- Today:
  - Keep heuristic classifier primary; attach ports for future ML.
  - Add a minimal rule runtime and circuit breaker util.
  - Optional `/api/rules` with Redis-backed storage.
- Near-term:
  - Introduce Python microservice for t‑SNE + spectral classification; plug via ClassificationPort.
  - Add uncertainty bands panel in UI via `adaptiveSimulation`.

## 8. Security & safety

- No execution of untrusted code. Rules use a constrained parser and evaluator.
- Authentication/authorization required to mutate rule sets (to be added when admin auth exists).
- Structured logs via `src/lib/logger.ts` for audit.

## 9. References

- t‑SNE: van der Maaten & Hinton (2008)
- Spectral Clustering: Ng, Jordan, Weiss (2001)
- Microsoft RulesEngine (GitHub)
- GoRules (Rust) – high performance rule evaluation
- Circuit Breaker pattern (Nygard)

See also: `docs/pitfalls-and-risk-mitigation.md` for systemic failure modes and the mitigation strategies implemented in this platform.
