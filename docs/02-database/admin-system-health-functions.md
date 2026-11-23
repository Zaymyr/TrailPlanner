---
title: Admin System Health Functions
scope: database
last_verified: 2026-11-23
ai_priority: medium
related_files:
  - supabase/migrations/20261123090000_admin_system_health.sql
  - supabase/tests/admin_system_health_checks.sql
  - apps/web/lib/admin-system-health.ts
  - apps/web/lib/admin-system-health-server.ts
  - apps/web/app/api/admin/system/health/route.ts
related_tables:
  - transactional_email_log
---

# Admin system health functions

## Purpose

Read-only SQL functions the admin console (lot 3, « Santé des systèmes ») calls with the service role to know whether the scheduled tasks run: `cron.job` and `cron.job_run_details` (pg_cron) and `net._http_response` (pg_net) are not exposed by PostgREST, so these `SECURITY DEFINER` functions return only what the console shows.

## Key Concepts

- Both functions are `SECURITY DEFINER` with `search_path = ''`, revoked from `public`, `anon`, `authenticated`, executable by `service_role` only; they are called by `lib/admin-system-health-server.ts` (`POST /rest/v1/rpc/<name>` with `{}`).
- Created by `20261123090000_admin_system_health.sql`, with the `transactional_email_log` table and its purge job. Control script: `supabase/tests/admin_system_health_checks.sql`.

## `public.admin_cron_job_status()`

One row per `cron.job`, ordered by name:

| Column | Source |
| --- | --- |
| `job_name`, `schedule`, `active` | `cron.job.jobname`, `schedule`, `active`. |
| `last_start`, `last_end`, `last_status` | Latest `cron.job_run_details` row of the job (highest `runid`): `start_time`, `end_time`, `status` (`starting`, `running`, `succeeded`, `failed`). |
| `last_message` | `left(return_message, 300)` of that run. |
| `runs_24h`, `failures_24h` | Runs and `failed` runs started in the last 24 h. |

The job `command` is never returned: `push-reminders-daily` and `organizer-import-cleanup-hourly` embed a secret in it (the later jobs read Vault at run time).

`purge_cron_job_run_details()` (same migration, `SECURITY DEFINER`, empty search path, service role only) deletes `cron.job_run_details` rows older than 7 days; the pg_cron job `cron-job-run-details-purge` (`41 4 * * *`) runs it daily, because Supabase never purges that table and `admin_cron_job_status()` reads it on every badge refresh.

Jobs created by the migrations (names are the console's catalog, `SCHEDULED_TASKS` in `lib/admin-system-health.ts`): `push-reminders-daily` (`0 9 * * *`, Edge Function), `organizer-import-cleanup-hourly` (`17 * * * *`), `social-posts-publish` (`*/5 * * * *`), `reel-automation` (`17 * * * *`), `carousel-automation` (`47 * * * *`), `demo-race-refresh` (`5 * * * *`), `flyover-orders` (`*/10 * * * *`), `transactional-email-log-purge` (`23 4 * * *`). Schedules are UTC.

## `public.admin_pg_net_response_summary()`

One row: `available` (false when `net._http_response` does not exist or cannot be read), `responses`, `errors` (status ≥ 400, no status, timed out or `error_msg`), `oldest_at`, `last_error_at`, `last_error_status`, `last_error_message` (200 characters). Response bodies and headers are never read. The table is written via dynamic SQL so the function compiles where pg_net is absent.

## Gotchas

- pg_cron `succeeded` for a pg_net job only means the HTTP request was queued. `net._http_response` keeps neither the URL nor the job (and only about 6 h of rows), so an HTTP status cannot be tied to a job: the console shows this summary for all jobs together and documents the limit.
- A pg_net job also succeeds while the Vault secrets `web_app_url` / `cron_secret` are missing: its `select` returns no row and nothing is sent.
- `cron.job_run_details` is never purged by pg_cron; `failures_24h` scans it. If it grows large, add a purge job (not done in lot 3).
- The Vercel crons of `vercel.json` are not pg_cron jobs and never appear here; the console lists them from `VERCEL_CRONS`.

## Related Docs

- [transactional_email_log](tables/transactional-email-log.md)
- [Web App Architecture](../01-architecture/web-app.md)
- [Ops](../context/OPS.md)

Refactor (2026-11-23, lot 4): `lib/admin-system-health-server.ts` reads through the shared helpers of `lib/admin-service-rest.ts` (same requests, same `settle` behaviour); the functions and their callers are unchanged. The payments health line now links to `/admin/billing`.
