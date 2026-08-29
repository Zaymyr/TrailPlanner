---
title: Infrastructure
scope: architecture
last_verified: 2026-08-29
ai_priority: high
related_files:
  - vercel.json
  - apps/mobile/eas.json
  - apps/mobile/react-native.config.js
  - apps/mobile/app.config.ts
  - supabase/migrations/20260504133000_schedule_push_reminders_with_supabase_cron.sql
  - supabase/migrations/20260504094253_fix_push_reminders_cron_auth.sql
  - supabase/migrations/20260824114439_add_organizer_import_sessions_and_drafts.sql
  - apps/web/app/api/cron/organizer-import-cleanup/route.ts
  - apps/web/lib/stripe.ts
  - apps/web/app/api/organizer/publication-checkout/route.ts
  - supabase/functions/push-register/index.ts
  - supabase/functions/push-reminders/index.ts
related_tables:
  - push_devices
  - push_notification_events
  - rate_limit_entries
  - organizer_import_sessions
---

# Infrastructure

## Purpose

This document records the infrastructure visible from the repository: Vercel, EAS, Supabase, storage, Edge Functions, and scheduled jobs. It does not document secrets or dashboard-only configuration values.

## Key Concepts

- Vercel: web deployment target for the Next.js app.
- EAS: Expo build/update system for the mobile app.
- Supabase project: Auth, Postgres, Storage, Edge Functions, and cron.
- Vault-backed cron secret: secret used by pg_cron to call push reminder functions.
- Organizer import cleanup: hourly pg_cron GET to the protected web route so Storage cleanup precedes row deletion.
- Service role: server-only key used by trusted routes/functions.
- Organizer import documents are currently selected in the browser and identified in the preview only; no document bucket or OCR provider is configured yet.
- Organizer roadbooks use the private `organizer-imports` bucket. Browser uploads are restricted to the authenticated user's folder and to 25 MB PDF/JPEG/PNG/WebP files; the organizer website-import API removes them after analysis, including failures.

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
- production: store-oriented Android app bundle and iOS Release builds with remote app version source and automatic build-number incrementing.
- submit production for Android: Google Play `production` track with `releaseStatus: completed` (full rollout after Google approval).

`apps/mobile/app.config.ts` declares OTA updates through `expo-updates`:

- project id `c713a8a0-cd94-4f6e-9468-063c9c20da6c`
- updates URL `https://u.expo.dev/c713a8a0-cd94-4f6e-9468-063c9c20da6c`
- channels are set by the EAS profile.
- shared/iOS runtime `1.1.0` and Android runtime override `1.1.1` for the Android 16 / API 36 native release.

Expo SDK 54 / React Native 0.81 provide Android `compileSdkVersion` and `targetSdkVersion` 36 by default. The repository does not override those native defaults.

The app config intentionally keeps `@react-native-google-signin/google-signin` out of the iOS plugin list, and `apps/mobile/react-native.config.js` disables the package in the React Native iOS autolinking layer, because the mobile app only supports native Google Sign-In on Android; iOS stays on the browser OAuth path.

## Supabase

The repository uses Supabase for:

- Auth users and sessions.
- Postgres data and RLS.
- Storage buckets:
  - `race-gpx`: private GPX catalog/user race storage.
  - `plan-gpx`: private copied GPX per saved plan.
  - `race-images`: public race image storage, including organizer event PNG thumbnails under `organizer-events/<eventId>/`.
  - `product-images`: public product image storage.
  - `organizer-imports`: private temporary PDF/image uploads for organizer roadbook analysis; objects must not be retained after the analysis request.
- Edge Functions:
  - `push-register`
  - `push-reminders`
- pg_cron daily push reminder scheduling.
- pg_cron hourly organizer import cleanup scheduling.

## Scheduled Push Reminders

The push reminder schedule is declared in:

- `supabase/migrations/20260504133000_schedule_push_reminders_with_supabase_cron.sql`
- `supabase/migrations/20260504094253_fix_push_reminders_cron_auth.sql`

Both migrations configure a `push-reminders-daily` cron job. The later migration fixes cron auth details. The job posts to `/functions/v1/push-reminders` with an `x-cron-secret` header sourced from Vault.

The Edge Function validates the cron secret through a SECURITY DEFINER RPC before sending reminders.

## Organizer Import Cleanup

`20260824114439_add_organizer_import_sessions_and_drafts.sql` configures `organizer-import-cleanup-hourly` at minute 17 of each hour. `configure_organizer_import_cleanup_cron()` reads `web_app_url` and `cron_secret` from Vault and schedules a `net.http_get` request to `/api/cron/organizer-import-cleanup` with the bearer secret used by the web cron route.

The route selects expired service-only sessions, deletes each temporary object named by its source manifest, and only then deletes the session row. The migration deliberately does not grant SQL direct access to delete `storage.objects`. If either Vault secret is absent, configuration emits a notice and leaves the job unscheduled.

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
- `STRIPE_ORGANIZER_RACEBOOK_PRICE_ID`
- `STRIPE_ORGANIZER_PRO_PRICE_ID`
- `STRIPE_ORGANIZER_PRO_UPGRADE_PRICE_ID`
- `STRIPE_ORGANIZER_CHECKOUT_SUCCESS_URL` (optional)
- `STRIPE_ORGANIZER_CHECKOUT_CANCEL_URL` (optional)
- `NEXT_PUBLIC_POSTHOG_KEY`
- `NEXT_PUBLIC_POSTHOG_TOKEN`
- `NEXT_PUBLIC_POSTHOG_HOST`
- `EXPO_PUBLIC_POSTHOG_KEY`
- `EXPO_PUBLIC_POSTHOG_TOKEN`
- `EXPO_PUBLIC_POSTHOG_HOST`
- `RESEND_API_KEY`
- `OPENAI_API_KEY`
- `OPENAI_ORGANIZER_IMPORT_MODEL`
- `CRON_SECRET`
- `REVENUECAT_*`
- `EXPO_PUBLIC_REVENUECAT_*`
- `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID`

## Gotchas

- Never commit actual environment values into docs.
- Organizer Stripe Price ids must point to active, one-time EUR prices at exactly 99 €, 299 €, and 200 € excluding tax; the server rejects mismatched Price configuration.
- The service role key must stay server-side or inside Supabase functions.
- `RESEND_API_KEY` is server-only and must not be exposed as a `NEXT_PUBLIC_` or Expo public variable.
- The cron migrations depend on Supabase extensions and Vault secrets; local migration application may require project-specific setup.
- Organizer cleanup additionally requires matching Vault values `web_app_url` and `cron_secret`; `cron_secret` must equal the web deployment's `CRON_SECRET`.
- Do not replace the cleanup HTTP job with direct SQL deletion. The private Storage objects must be removed before their manifest row.
- The archived storage doc predates the image buckets.
- Organizer event image upload is mediated by a server route and stores only PNG files in `race-images`; clients should not receive service-role credentials.
- Keep `organizer-imports` private and owner-folder-scoped. The browser can upload and make a best-effort cleanup request, but service-role cleanup in the analysis route is the mandatory deletion path.
- `OPENAI_API_KEY` is server-only. The organizer import LLM is admin-only, returns a transient reviewed proposal, and must never receive service-role credentials.
- Do not reintroduce the Google Sign-In Expo config plugin on iOS or remove the explicit iOS block in `apps/mobile/react-native.config.js` unless the native iOS package is intentionally linked too; a half-enabled setup can crash at launch while React Native registers third-party Fabric components.
- Do not collapse the platform runtime split until iOS also ships a compatible new native binary. Publish Android production OTAs against runtime `1.1.1` and iOS OTAs against the existing `1.1.0` runtime.
- EAS Submit requires a Google service-account key registered in the project credentials; never commit that JSON key to the repository.

## Related Docs

- [Overview](overview.md)
- [Supabase Edge Functions](../05-integrations/supabase-edge-functions.md)
- [Resend](../05-integrations/resend.md)
- [Analytics](../05-integrations/analytics.md)
- [RLS Policies](../02-database/rls-policies.md)
- [Debug Supabase Auth](../06-workflows/debug-supabase-auth.md)
