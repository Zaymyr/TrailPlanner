---
title: reel_automation_settings Table
scope: database
last_verified: 2026-11-20
ai_priority: low
related_files:
  - supabase/migrations/20261120140000_add_reel_automation.sql
  - supabase/tests/reel_automation_checks.sql
  - apps/web/lib/reel-automation.ts
  - apps/web/app/api/admin/reel-automation/route.ts
  - supabase/migrations/20261120180000_add_instagram_carousels.sql
  - apps/web/app/api/admin/carousel-automation/route.ts
related_tables:
  - reel_automation_settings
---

# `reel_automation_settings`

## Purpose

The single settings row of the automatic reel pipeline: the two admin switches and the planning caps. See [Automatic Reel Pipeline](../../05-integrations/reel-automation.md).

## Columns

| Column | Type | Constraints/default | Purpose |
| --- | --- | --- | --- |
| `id` | `boolean` | primary key, default `true`, check `id` | Forces a single row (inserted by the migration). |
| `generation_enabled` | `boolean` | not null, default `false` | « Génération automatique »: the cron generates and renders due items. |
| `auto_publish_enabled` | `boolean` | not null, default `false`; check: only with `generation_enabled` | « Publication automatique »: drafts are scheduled at their planned slot without review. |
| `max_per_week` | `integer` | 1-7, default 3 | Reels per Monday-Sunday week. |
| `max_per_day` | `integer` | 1-3, default 1 | Reels per day. |
| `lead_days` | `integer` | 1-14, default 3 | Generation starts this many days before the planned day. |
| `publish_time` | `time` | default `18:00` | Paris wall time of the automatic publication. |
| `plan_carousel_enabled`, `brief_carousel_enabled`, `week_carousel_enabled` | `boolean` | not null, default `false` | One switch per carousel series ([Automatic Instagram Carousels](../../05-integrations/instagram-carousels.md)); added by `20261120180000_add_instagram_carousels.sql`. The reels avoid the weekday of every enabled series. The two switches above also drive carousel generation and publication. |
| `updated_by` | `uuid` | references `auth.users(id)` on delete set null, indexed | Admin who last changed a switch; owner of the automatic renders, narrations and drafts. |
| `updated_at` | `timestamptz` | not null, refreshed by trigger | Last change. |

The caps, lead time and publication time have no UI yet: change them in SQL if needed.

## Access

RLS on, no policy, every privilege revoked from `public`, `anon` and `authenticated`, granted to `service_role`. Read and written by `/api/admin/reel-automation` and `/api/admin/carousel-automation` (series switches) (`authorizeVideoAdmin`), and read by both cron routes.
