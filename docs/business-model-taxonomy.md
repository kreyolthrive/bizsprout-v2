# Business Model Taxonomy and Validation Requirements

This taxonomy defines 8 primary archetypes and the specific validation requirements for each. It maps cleanly to the engine keys used by `src/lib/adaptiveValidation.ts` and provides metrics, gates, and evidence patterns.

## Overview

### Archetypes (engine key → human label)

- saas-b2b → B2B SaaS
- saas-b2c → Consumer SaaS
- services-marketplace → Services Marketplace (generic)
- freelance-marketplace → Creative/Freelance Marketplace
- learning-marketplace → Learning/Course Marketplace (EdTech, two-sided)
- physical-subscription → Physical Subscription (DTC subscriptions, e.g., coffee)
- pm-software → Project Management (generic PM, saturated)
- regulated-services → Regulated Services (FinTech/Health sub-cases; see notes)

## Cross-cutting B2B vs B2C differences

- B2B: longer cycles (6–18 mo), multi-stakeholder validation, ACV, expansion revenue, sales cycle KPIs.
- B2C: shorter cycles (weeks–months), conversion rate by channel, viral coefficients, churn/retention focus.

---

## 1) B2B SaaS (saas-b2b)

- Core metrics: MRR growth 15–20% (early), CAC payback < 12 mo, NRR ≥ 100% (top quartile), Rule of 40 awareness.
- Gates: problem ≥ 3/10, economics ≥ 3/10, demand ≥ 2/10.
- Evidence: product engagement (DAU/WAU, activation), cohort retention, pilot ROI.
- Risks: high CAC for low price points, switching costs, migration friction.

## 2) Consumer SaaS (saas-b2c)

- Core metrics: activation and day-7/30 retention; CAC/LTV viable with virality or strong organic.
- Gates: demand ≥ 2/10, economics ≥ 3/10.
- Evidence: conversion funnels, retention curves, pricing sensitivity.

## 3) Services Marketplace (services-marketplace)

- Core metrics: min viable liquidity (supply:demand ratio), GMV growth, take-rate economics, leakage.
- Gates: demand ≥ 2/10, economics ≥ 3/10; saturation cap overall 15 when ≥ 90%.
- Evidence: escrow, QA, managed features to reduce leakage and boost trust.

## 4) Creative/Freelance Marketplace (freelance-marketplace)

- Core metrics: category liquidity and quality signals; reputations, repeat rates; take-rate viability.
- Gates: similar to services-marketplace; creative-specific trust/quality.
- Evidence: curated supply, brief templates, QA review.

## 5) Learning/Course Marketplace (learning-marketplace)

- Core metrics: cohort completion %, NPS, credential acceptance, refund rate, GMV×take-rate.
- Gates: marketplace gates + trust/credentialization; saturation cap behavior.
- Evidence: live cohorts, verified certificates/portfolios, community and office hours.

## 6) Physical Subscription (physical-subscription)

- Core metrics: COGS%, shipping/packaging leakage, gross margin %, CAC payback < 6–12 mo, LTV:CAC ≥ 3.
- Gates: stronger economics threshold (≥ 3.5/10 recommended floor in engine).
- Evidence: first-box satisfaction, retention, pause/skip/swap.

## 7) Project Management (pm-software)

- Core metrics: activation and switch intent in a vertical; migration tooling; ROI proof via pilots.
- Gates: conservative floors; saturation caps similar to marketplaces.
- Evidence: vertical workflows, integrations, ROI calculators.

## 8) Regulated Services (regulated-services)

- Core metrics: compliance pathway (licenses, AML/KYC), capital adequacy and liquidity (FinTech), clinical outcomes (Health).
- Gates: must pass regulatory feasibility before scaling; attach a regulatory status to scoring calibration.
- Evidence: policy gates (SEC/CFPB/FinCEN), HIPAA/BAAs, FDA pathways, audit trails.

---

## Evidence templates and experiments per model

- Marketplaces (services/creative/learning):
  - Supply seeding (5–10 credible suppliers), demand partner pilots, escrow and QA, verified credentialing.
  - Milestones: managed matches, refund/leakage < 15%, GMV and repeat purchase rate.
- SaaS: pilots with activation goals, migration tooling, ROI proof; Rule of 40 as a sanity check post-PMF.
- Physical subscription: taste/fit quiz, sampler, pause/skip/swap; gross margin and payback checkpoints.
- Regulated services: compliance readiness checklist, identity/AML controls, liability coverage.

## Mapping to engine

- Weights and gates live in `DEFAULT_WEIGHTS` and `DEFAULT_GATES`.
- Saturation caps (overall) are applied to saturated categories for realism.
- API attaches `adaptive_validation` snapshot for UI transparency.

## Notes

- FinTech and Healthcare could be split into specific keys later (e.g., fintech-issuer, payments-iso, healthcare-clinical), each with stricter gates.
- EdTech sits under `learning-marketplace` for two-sided models; institution-led EdTech could be a future `edtech-institutional` key.
