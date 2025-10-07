# Backups

Database (Supabase):

- Ensure automated backups are enabled on your Supabase project (paid tiers).
- Define RPO/RTO targets (e.g., RPO ≤ 24h, RTO ≤ 2h).
- Test restore to a staging project quarterly.

Storage (Supabase Storage):

- Enable object versioning if needed for critical assets.
- Consider lifecycle rules for cold storage.

Process:

1. In an incident, snapshot current state if possible.
2. Restore from the most recent good backup to staging.
3. Validate integrity and app behaviors.
4. Promote or re-point prod to the recovered dataset.
