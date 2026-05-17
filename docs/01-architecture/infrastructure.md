---
title: Infrastructure
scope: architecture
last_verified: 2026-05-17
ai_priority: high
related_files:
  - vercel.json
  - apps/mobile/eas.json
  - apps/mobile/app.config.ts
  - supabase/migrations/20260504133000_schedule_push_reminders_with_supabase_cron.sql
  - supabase/migrations/20260504094253_fix_push_reminders_cron_auth.sql
  - supabase/functions/push-register/index.ts
  - supabase/functions/push-reminders/index.ts
related_tables:
  - push_devices
  - push_notification_events
  - rate_limit_entries
---

# Infrastructure

## Purpose

This document records the infrastructure visible from the repository: Vercel, EAS, Supabase, storage, Edge Functions, and scheduled jobs. It does not document secrets or dashboard-only configuration values.

## Key Concepts

- Vercel: web deployment target for the Next.js app.
- EAS: Expo build/update system for the mobile app.
- Supabase project: Auth, Postgres, Storage, Edge Functions, and cron.
- Vault-backed cron secret: secret used by pg_cron to call push reminder functions.
- Service role: server-only key used by trusted routes/functions.

## Vercel

`vercel.json` configures the web deployment:

```json
{
  "framework": "nextjs",
  "buildCommand": "npm run build",
  "installCommand": "npm install --legacy-peer-deps",
  "outputDirectory": ".next"
}
```

It also redirects:

- `trailplanner.app/*` to `https://pace-yourself.com/*`
- `trail-planner.vercel.app/*` to `https://pace-yourself.com/*`

The root build command maps to `package.json` script `build`, which runs Turbo.

## EAS

`apps/mobile/eas.json` defines three build profiles:

- development: internal distribution with a development client.
- preview: internal distribution with APK for Android.
- production: store-oriented builds with remote app version source.

`apps/mobile/app.config.ts` declares OTA updates through `expo-updates`:

- project id `c713a8a0-cd94-4f6e-9468-063c9c20da6c`
- updates URL `https://u.expo.dev/c713a8a0-cd94-4f6e-9468-063c9c20da6c`
- channels are set by the EAS profile.

## Supabase

The repository uses Supabase for:

- Auth users and sessions.
- Postgres data and RLS.
- Storage buckets:
  - `race-gpx`: private GPX catalog/user race storage.
  - `plan-gpx`: private copied GPX per saved plan.
  - `race-images`: public race image storage.
  - `product-images`: public product image storage.
- Edge Functions:
  - `push-register`
  - `push-reminders`
- pg_cron daily push reminder scheduling.

## Scheduled Push Reminders

The push reminder schedule is declared in:

- `supabase/migrations/20260504133000_schedule_push_reminders_with_supabase_cron.sql`
- `supabase/migrations/20260504094253_fix_push_reminders_cron_auth.sql`

Both migrations configure a `push-reminders-daily` cron job. The later migration fixes cron auth details. The job posts to `/functions/v1/push-reminders` with an `x-cron-secret` header sourced from Vault.

The Edge Function validates the cron secret through a SECURITY DEFINER RPC before sending reminders.

## Rate Limiting

`supabase/migrations/20260304120000_add_rate_limit_entries.sql` creates:

- `rate_limit_entries`
- `check_and_increment_rate_limit`
- `purge_expired_rate_limit_entries`

`apps/web/lib/http.ts` uses `checkRateLimitAsync` for DB-backed rate limiting when service config is available and falls back to in-memory rate limiting in local or failure scenarios.

## Environment Variables

Document variable names, not secret values. Important names visible in code include:

- `SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `SUPABASE_SERVICE_ROLE`
- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `STRIPE_PRICE_ID`
- `STRIPE_CHECKOUT_SUCCESS_URL`
- `STRIPE_CHECKOUT_CANCEL_URL`
- `STRIPE_BILLING_RETURN_URL`
- `NEXT_PUBLIC_POSTHOG_KEY`
- `NEXT_PUBLIC_POSTHOG_TOKEN`
- `NEXT_PUBLIC_POSTHOG_HOST`
- `EXPO_PUBLIC_POSTHOG_KEY`
- `EXPO_PUBLIC_POSTHOG_TOKEN`
- `EXPO_PUBLIC_POSTHOG_HOST`
- `REVENUECAT_*`
- `EXPO_PUBLIC_REVENUECAT_*`

## Gotchas

- Never commit actual environment values into docs.
- The service role key must stay server-side or inside Supabase functions.
- The cron migrations depend on Supabase extensions and Vault secrets; local migration application may require project-specific setup.
- The archived storage doc predates the image buckets.

## Related Docs

- [Overview](overview.md)
- [Supabase Edge Functions](../05-integrations/supabase-edge-functions.md)
- [Analytics](../05-integrations/analytics.md)
- [RLS Policies](../02-database/rls-policies.md)
- [Debug Supabase Auth](../06-workflows/debug-supabase-auth.md)
