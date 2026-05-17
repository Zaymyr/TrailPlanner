---
title: Supabase Edge Functions
scope: integration
last_verified: 2026-05-17
ai_priority: high
related_files:
  - supabase/functions/push-register/index.ts
  - supabase/functions/push-reminders/index.ts
  - supabase/functions/_shared/push.ts
  - supabase/migrations/20260504120000_add_push_notifications.sql
  - supabase/migrations/20260504133000_schedule_push_reminders_with_supabase_cron.sql
  - supabase/migrations/20260504094253_fix_push_reminders_cron_auth.sql
related_tables:
  - push_devices
  - push_notification_events
---

# Supabase Edge Functions

## Purpose

This document describes the Supabase Edge Functions currently present in the repo. They support Expo push registration and scheduled push reminders.

## Key Concepts

- Edge Function: Supabase Deno function under `supabase/functions`.
- Expo push token: device token stored in `push_devices`.
- Cron secret: Vault-backed secret used by pg_cron to authorize scheduled calls.
- Dedupe key: event key used to avoid repeated reminder sends.

## Functions

### `push-register`

Path: `supabase/functions/push-register/index.ts`

Purpose:

- authenticate the user;
- accept Expo push token/device metadata;
- upsert a `push_devices` row.

Expected data includes:

- Expo token;
- platform;
- locale;
- app version;
- notifications enabled flag.

### `push-reminders`

Path: `supabase/functions/push-reminders/index.ts`

Purpose:

- validate `x-cron-secret`;
- call shared reminder logic;
- send scheduled Expo push notifications.

The function validates the cron secret through a Supabase RPC before doing reminder work.

### `_shared/push.ts`

Shared implementation:

- sends push messages through the Expo Push API;
- chunks sends in batches;
- checks inactivity after roughly 72 hours;
- checks unfinished plans after roughly 24 hours;
- writes `push_notification_events` for send logging and dedupe.

## Cron Scheduling

Migrations schedule the daily job:

- `20260504133000_schedule_push_reminders_with_supabase_cron.sql`
- `20260504094253_fix_push_reminders_cron_auth.sql`

The job name is `push-reminders-daily` and runs at `0 9 * * *` in the migration SQL.

## Environment Variables

Important names:

- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `EXPO_ACCESS_TOKEN` optional for Expo push API.

## Gotchas

- The Edge Function service role must not be exposed to clients.
- Cron auth depends on Supabase Vault setup, not just SQL files.
- Push dedupe behavior depends on `push_notification_events`; do not remove logging as "noise."
- The two cron migrations are related; the later one repairs auth behavior.

## Related Docs

- [Infrastructure](../01-architecture/infrastructure.md)
- [Schema Overview](../02-database/schema-overview.md)
- [RLS Policies](../02-database/rls-policies.md)
- [Mobile App](../01-architecture/mobile-app.md)
