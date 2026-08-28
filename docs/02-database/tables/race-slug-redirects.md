---
title: race_slug_redirects Table
scope: database
last_verified: 2026-08-28
ai_priority: high
related_files:
  - supabase/migrations/20260828161008_add_race_slug_redirects.sql
  - supabase/tests/race_slug_redirects_checks.sql
  - apps/web/lib/public-races.ts
  - apps/web/lib/public-races.test.ts
  - apps/web/app/courses/[slug]/page.tsx
  - apps/web/app/courses/[slug]/page.test.ts
  - scripts/audit-public-race-slugs.mjs
  - scripts/audit-public-race-slugs.test.mjs
related_tables:
  - race_slug_redirects
  - races
  - race_events
---

# `race_slug_redirects`

## Purpose

`race_slug_redirects` preserves every former public course slug so indexed URLs and inbound links can permanently redirect to the current `races.slug`.

## Key Concepts

- Former slug: a previously canonical course slug stored once in `old_slug`.
- Stable target: `race_id` points to the race row, not another redirect, so repeated renames do not create redirect chains.
- Reserved slug: a former slug cannot later be assigned to any race.
- Public resolution: clients can read a mapping only while its race remains live/public and its optional parent event remains live.

## Columns

| Column | Type | Purpose |
| --- | --- | --- |
| `old_slug` | `text` primary key | Former lowercase slug, limited to 160 characters and hyphen-separated ASCII letters/digits. |
| `race_id` | `uuid` not null | Stable target race. |
| `created_at` | `timestamptz` not null | UTC creation time of the redirect. |

## Foreign Keys

- `race_id -> races(id) on delete cascade`

Deleting the target race removes mappings that can no longer resolve. Renaming the race retains all prior mappings because each row targets the stable race id.

## Indexes

- Primary key on `old_slug` supports direct legacy URL lookup.
- `race_slug_redirects_race_id_idx` supports resolving and auditing every prior slug for one race.

## RLS Policies

RLS is enabled. `anon` and `authenticated` have `SELECT` only, with an `exists` policy requiring `races.is_live = true`, `races.is_public = true`, and a live parent `race_events` row when `event_id` is non-null. `service_role` alone receives mutation privileges and can execute `rename_race_slug(uuid, text)`.

Both mutation functions are `SECURITY INVOKER`, use an empty `search_path`, and revoke execution from `PUBLIC`, `anon`, and `authenticated`.

## Business Invariants

- Updating `races.slug` records the prior slug in the same transaction.
- Inserts and updates reject a slug already reserved in this table.
- Transaction advisory locks serialize reservations for the old and new names; the existing unique race-slug constraint remains the canonical-name collision guard.
- `rename_race_slug` normalizes trim/case, validates the allowed slug format, locks the race row, updates it, and lets the trigger record the redirect atomically.
- The public web route returns a permanent redirect only after reloading the target through the current public visibility gates.

## Common Queries

Resolve a visible former slug through the anon Data API:

```sql
select race_id
from public.race_slug_redirects
where old_slug = :old_slug;
```

Rename a race from trusted service code after reviewing the dry-run report:

```sql
select *
from public.rename_race_slug(:race_id, :new_slug);
```

## Gotchas

- Do not update `races.slug` in bulk from the browser. Review `scripts/audit-public-race-slugs.mjs` output, then invoke the service-only RPC for approved rows.
- Do not expose redirects for hidden/private races; the page must remain not found until the target is public again.
- Do not point one redirect at another slug. Always resolve through `race_id` to the current canonical slug.
- The migration is versioned locally but has not been applied to a remote database by this change.

## Related Docs

- [races](races.md)
- [race_events](race-events.md)
- [Public Race Discovery](../../03-business-rules/public-race-discovery.md)
- [RLS Policies](../rls-policies.md)
- [Migrations](../migrations.md)
