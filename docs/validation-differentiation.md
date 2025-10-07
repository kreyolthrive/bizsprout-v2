# Validation differentiation across business models

This guide details how validation criteria, timelines, and KPIs differ across business types. It’s grounded in case studies and industry analysis and aligns with the adaptive engine and policy mapping in this repo.

## Enterprise B2B SaaS

Focus areas

- Integration capabilities (SSO/SAML, SCIM, key apps), API quality, data model fit
- Security compliance (SOC 2, ISO 27001), data residency, access controls
- Scalability under load (p95 latency, throughput), reliability (SLOs), change management

Validation cadence & timeline

- Typical evaluation cycles: 6–12 months with multiple stakeholders (IT, Security, Procurement, Line-of-Business)

Key KPIs & gates

- Pilot conversion ≥ 30–50% when sponsor exists; multi-stakeholder sign-offs
- Security posture: SOC2 available or roadmap with interim controls; pen test findings triaged
- Performance: meets SLOs; degradation ≤ 5% under projected load; disaster recovery runbooks

## Consumer/B2C marketplace

Focus areas

- User acquisition efficiency and early liquidity: city/vertical seeding, supply-demand balance, trust mechanisms
- Transaction growth and retention; disintermediation risk controls

Validation cadence & timeline

- Rapid cycles from days to weeks; local-market testbeds

Key KPIs & gates

- CAC bands: $30–$150 depending on price point; ROAS targets by channel
- Visitor→lead 1–3%; lead→opportunity 10–15% for B2B-style funnels; for B2C, track signup→first-transaction conversion and 7/30-day retention
- Time-to-liquidity: median search-to-match < 24–72h in early markets

## FinTech

Focus areas

- Regulatory compliance: AML/KYC, licensing, capital adequacy (as applicable), multi-jurisdiction alignment
- Fraud prevention effectiveness; transaction processing reliability; onboarding efficiency
- Stress testing scenarios and incident response

Validation cadence & timeline

- Staged validation: sandbox/pilot → supervised scale → broader rollout

Key KPIs & gates

- KYC pass rate ≥ 85–95% (geo-dependent) with low false negatives; AML alert precision targets
- Fraud loss rate within target (e.g., < 30–50 bps depending on product)
- Processing reliability: p99 failure rate within SLO; reconciliation accuracy ≥ 99.9%
- Capital adequacy: buffers per regulator guidance (if lending/deposits)

## Healthcare technology

Focus areas

- Clinical efficacy; FDA/CE pathway validation; provider workflow integration; reimbursement model readiness
- Patient outcomes measurement; data privacy (HIPAA), PHI handling, interoperability (HL7/FHIR)

Validation cadence & timeline

- Evidence-driven; often multi-quarter with pilot sites and IRB considerations

Key KPIs & gates

- Clinical endpoints: statistically significant improvement vs baseline or SoC
- Provider adoption: workflow fit, training completion; time-to-task unaffected or improved
- Reimbursement: codes available/approved; successful claims within target timelines

## How to use this in the platform

- Use the policy module to detect context (enterprise vs consumer, regulated vs not, physical vs digital) and attach the appropriate framework(s).
- Map KPIs and gates to rule definitions to auto-flag issues and push dimensions to review/fail.
- For regulated flows (FinTech/Healthcare), enable compliance-heavy validation tracks and stricter caps.
