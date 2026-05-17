---
title: race_plans Table
scope: database
last_verified: 2026-05-17
ai_priority: high
related_files:
  - supabase/migrations/20241215010000_create_race_plans.sql
  - supabase/migrations/20251220120000_add_race_catalog.sql
  - supabase/migrations/20260324000000_refactor_race_catalog_to_races.sql
  - supabase/migrations/20260408110000_set_race_plans_race_fk_on_delete_set_null.sql
  - apps/web/app/api/plans/route.ts
  - apps/web/app/api/plans/from-catalog/route.ts
  - apps/web/app/api/onboarding/save-plan/route.ts
related_tables:
  - race_plans
  - plan_aid_stations
  - races
  - coach_comments
---

# `race_plans`

## Purpose

`race_plans` stores saved planner state for a user or coachee. It is the durable home for `planner_values`, elevation profiles, and imported catalog GPX metadata.

## Key Concepts

- `planner_values`: flexible JSONB state used to hydrate the planner.
- `elevation_profile`: separate JSONB array of distance/elevation points.
- `race_id`: optional link to the source `races` row.
- `coach_id`: optional coach owner for coachee plans.
- `plan_gpx_path`: private storage key in the `plan-gpx` bucket.

## Columns

| Column | Type | Constraints/default | Purpose |
| --- | --- | --- | --- |
| `id` | `uuid` | primary key, default `gen_random_uuid()` | Stable plan id. |
| `created_at` | `timestamptz` | not null, default UTC `now()` | Creation time. |
| `updated_at` | `timestamptz` | not null, default UTC `now()`, trigger-maintained | Last update time. |
| `user_id` | `uuid` | not null, default `auth.uid()` | Plan owner/coachee id. |
| `coach_id` | `uuid` | nullable, references `user_profiles(user_id)` | Coach id when a coach creates/manages a coachee plan. |
| `name` | `text` | not null | User-visible plan name. |
| `planner_values` | `jsonb` | not null | Main planner state. |
| `elevation_profile` | `jsonb` | not null, default `[]` | Elevation data stored separately from planner JSON. |
| `race_id` | `uuid` | nullable, references `races(id)` on delete set null | Source race link after catalog import. |
| `catalog_race_updated_at_at_import` | `timestamptz` | nullable | Snapshot of source race update time when imported. |
| `plan_gpx_path` | `text` | nullable | Private copied GPX object path in `plan-gpx`. |
| `plan_course_stats` | `jsonb` | not null, default `{}` | Parsed GPX stats for imported plans. |

## Foreign Keys

- `coach_id -> public.user_profiles(user_id)`
- `race_id -> public.races(id) on delete set null`

`user_id` defaults to `auth.uid()` and is treated as an auth user id in code and policies.

## Indexes

- `race_plans_user_id_idx` on `user_id`
- `race_plans_coach_id_idx` on `coach_id`

## RLS Policies

See [../rls-policies.md](../rls-policies.md) for full policy text.

Summary:

- Users can select, insert, update, and delete own plans.
- Coaches can access coachee plans only through active coach/coachee relationships.
- Anon role privileges are granted so anonymous Supabase users with `auth.uid()` can access their own plans through RLS.

## Business Invariants

- `planner_values` is the main persisted planner state after signup.
- Onboarding saves should be idempotent; do not save twice on email confirmation or duplicated auth events.
- `race_id` can be null. Deleting a race must detach plans, not delete them.
- `catalog_race_updated_at_at_import` is a source snapshot, not a live sync guarantee.
- `plan_gpx_path` belongs to the copied plan GPX, not the source race GPX.

## Common Queries

Fetch a user's plans:

```sql
select id, name, created_at, updated_at, planner_values, elevation_profile, race_id
from public.race_plans
where user_id = auth.uid()
order by updated_at desc;
```

Detach plans from a race before deleting the race:

```sql
update public.race_plans
set race_id = null
where race_id = '<race-id>';
```

## Gotchas

- `catalog_race_id` is the old column name. Current migrations rename it to `race_id`.
- `planner_values` can contain older shape variants. Hydration code must tolerate missing fields.
- `apps/web/app/api/plans/route.ts` can update an existing plan by name when creating a plan.

## Related Docs

- [Plan Storage](../../03-business-rules/plan-storage.md)
- [GPX Import](../../03-business-rules/gpx-import.md)
- [Relationships](../relationships.md)
- [RLS Policies](../rls-policies.md)
