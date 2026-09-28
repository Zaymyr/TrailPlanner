---
title: racebook_gear_checks Table
scope: database
last_verified: 2026-09-28
ai_priority: high
related_files:
  - supabase/migrations/20260924140119_add_racebook_gear_checks.sql
  - supabase/tests/racebook_gear_checks.sql
  - apps/mobile/lib/racebookGearChecklist.ts
  - apps/mobile/components/racebook/RacebookGearSection.tsx
  - apps/mobile/app/(app)/race/[id]/racebook.tsx
  - apps/mobile/lib/racebookGearAnalytics.ts
  - apps/mobile/lib/racebookGearAnalytics.test.ts
  - apps/mobile/lib/racebookGearItemKey.ts
  - scripts/backfill-racebook-gear-state-posthog.mjs
related_tables:
  - racebook_gear_checks
  - user_profiles
  - races
---

# `racebook_gear_checks`

## Purpose

`racebook_gear_checks` stores the runner's per-format RaceBook equipment checklist. A signed-in account sees the same checked items on every device using that account.

## Columns

| Column | Type | Constraints/default | Purpose |
| --- | --- | --- | --- |
| `user_id` | `uuid` | primary-key part, references `user_profiles(user_id)` on delete cascade | Checklist owner. |
| `race_id` | `uuid` | primary-key part, references `races(id)` on delete cascade | Exact course format whose equipment is being prepared. |
| `item_key` | `text` | primary-key part, 1–320 characters | Stable organizer item id, or deterministic group-and-label fallback. |
| `checked_at` | `timestamptz` | not null, UTC `now()` | First persisted check time. |

## RLS Policies

- `anon` has no table grant.
- `authenticated` may select, insert, and delete only rows whose `user_id` equals `auth.uid()`.
- Rows are append/remove state; authenticated clients receive no update grant or policy.
- `service_role` retains explicit full access for administration and cleanup.

## Business Invariants

- State is isolated by both user and exact `race_id`; two formats of one event never share completion.
- Organizer equipment changes do not rewrite runner rows. The UI counts only keys that still match currently published items, so removed items become harmless dormant rows.
- Items with a persisted organizer id use it. Legacy items without an id use a deterministic normalized-label key scoped by required/recommended/weather group.
- Toggling is optimistic in the app and rolls back visibly if the owner-scoped database write fails.
- After a confirmed insert/delete, mobile emits `racebook gear item toggled`. The event includes the bounded published item label/id, required/recommended/weather group, weather context, and checked state, but never `item_key`, notes, or total checklist state. Failed writes emit nothing.
- After a successful non-empty load, and after persisted changes settle, mobile emits `racebook gear item state synced` once per currently published item. This bounded snapshot distinguishes checked from missing items only for runners who started the checklist; a plain RaceBook open with no saved or successful interaction state emits no missing-item snapshot.
- Leaving a RaceBook replaces it with Courses instead of another previously opened format; persisted checks remain keyed by account and exact `race_id` across navigation.
- Compact sponsor rows and the Ravitos endpoint timing/spacing presentation do not read or mutate equipment-check rows.
- Fullscreen route/profile presentation and tappable ravito points do not read or mutate equipment-check rows.

## Related Docs

This table remains the source of truth for current checked state. PostHog organizer rankings use the latest observed state per person, race, and published analytics item inside the selected reporting window; they exclude runners who never started the checklist and must not be presented as a live table snapshot. The marker-guarded `racebook_gear_state_2026_09_28` import seeded checked and missing states only for users represented by existing rows.

- [Schema Overview](../schema-overview.md)
- [Relationships](../relationships.md)
- [RLS Policies](../rls-policies.md)
- [Mobile App](../../01-architecture/mobile-app.md)
