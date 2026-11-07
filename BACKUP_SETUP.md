# D1 backup setup

The owner backup module stores full D1 SQL exports in a private R2 bucket. It does not expose public object URLs.

## Required account configuration

1. Enable R2 for the Cloudflare account and create a private bucket named `agentstvo-podarkov-backups`.
2. Add the R2 binding to the Worker:
   - binding: `BACKUP_BUCKET`
   - bucket: `agentstvo-podarkov-backups`
3. Configure the Worker secret `CLOUDFLARE_API_TOKEN`. Use a dedicated token with the minimum D1 permissions needed for database export and import. Do not put the token in GitHub, frontend code, or chat.
4. Keep the existing D1 binding `DB`, Telegram secrets, and Worker routes unchanged.

## Schedule

- Existing campaign queue: every minute (`*/1 * * * *`).
- Monthly full D1 export: 03:00 UTC on the first day of each month.
- Export jobs are polled on subsequent minute triggers. Cloudflare notes that D1 may be unavailable while an export is running.
- Two newest regular SQL backups are retained. Pre-restore safety copies are stored separately.

## Restore safety

Restore is owner-only and requires two explicit stages:
1. Create a fresh safety export of the current D1 database.
2. After the safety export is complete, confirm the selected backup again.

The D1 import replaces the database contents. Do not run restore during active orders or payments. Never test restore against production. First validate against a separate disposable D1 database.

## Current status

R2 is not enabled on the connected account yet, so the bucket and binding have not been created. No D1 export/import has been started. The module is staged in the feature branch only.
