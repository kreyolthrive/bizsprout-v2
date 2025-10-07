# Rollback Procedure (Vercel)

1. Identify the last known good deployment in Vercel (Deployments tab).
2. Click the kebab menu and select "Promote to Production" to immediately roll back.
3. If environment variables changed, revert them to the previous snapshot as well.
4. If database migrations were applied, evaluate if a down migration is required or if you can tolerate forward-only schema.
5. Post-rollback, monitor logs, Sentry, and health checks.
