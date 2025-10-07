# Incident Response

Severity Levels:

- SEV1: Complete outage or data loss
- SEV2: Major functionality degraded
- SEV3: Minor functionality issues

On-call & Ownership:

- Primary: <owner>
- Secondary: <backup>

Playbook:

1. Acknowledge alert (Sentry or monitoring system).
2. Capture current state (logs, error IDs, key metrics).
3. Triage severity and impact; communicate status to stakeholders.
4. Mitigate (feature flag, rollback, hotfix) to restore service.
5. Post-incident review within 48h; track action items.
