---
title: racebook_gear_checks Table
scope: database
last_verified: 2026-09-24
ai_priority: high
related_files:
  - supabase/migrations/20260924140119_add_racebook_gear_checks.sql
  - supabase/tests/racebook_gear_checks.sql
  - apps/mobile/lib/racebookGearChecklist.ts
  - apps/mobile/components/racebook/RacebookGearSection.tsx
  - apps/mobile/app/(app)/race/[id]/racebook.tsx
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
- Leaving a RaceBook replaces it with Courses instead of another previously opened format; persisted checks remain keyed by account and exact `race_id` across navigation.

## Related Docs

- [Schema Overview](../schema-overview.md)
- [Relationships](../relationships.md)
- [RLS Policies](../rls-policies.md)
- [Mobile App](../../01-architecture/mobile-app.md)
