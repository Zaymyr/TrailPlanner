---
title: race_slug_redirects Table
scope: database
last_verified: 2026-09-23
ai_priority: high
related_files:
  - supabase/migrations/20260828161008_add_race_slug_redirects.sql
  - supabase/migrations/20260923070437_separate_web_and_mobile_race_visibility.sql
  - supabase/tests/race_slug_redirects_checks.sql
  - apps/web/lib/public-races.ts
  - apps/web/lib/public-races.test.ts
  - apps/web/app/courses/[slug]/page.tsx
  - apps/web/app/courses/[slug]/page.test.ts
  - apps/web/app/courses/[slug]/race-metadata.ts
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
- Public resolution: direct clients keep the historical live/public parent gate. The server-rendered web route uses its service-only explicit-column lookup and separately revalidates `web_catalog_is_live`, `is_public`, and optional parent-event liveness, so mobile hiding does not remove an indexed redirect.

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

RLS is enabled. `anon` and `authenticated` retain `SELECT` only under the historical `races.is_live = true`, `races.is_public = true`, and live optional parent-event gate. The web route resolves web-only redirects server-side with service role and repeats its stricter current-target checks. `service_role` alone receives mutation privileges and can execute `rename_race_slug(uuid, text)`.

Both mutation functions are `SECURITY INVOKER`, use an empty `search_path`, and revoke execution from `PUBLIC`, `anon`, and `authenticated`.

## Business Invariants

- Updating `races.slug` records the prior slug in the same transaction.
- Inserts and updates reject a slug already reserved in this table.
- Transaction advisory locks serialize reservations for the old and new names; the existing unique race-slug constraint remains the canonical-name collision guard.
- `rename_race_slug` normalizes trim/case, validates the allowed slug format, locks the race row, updates it, and lets the trigger record the redirect atomically.
- The public web route returns a permanent redirect only after reloading the target through the current public visibility gates, and it redirects before loading the richer organizer/GPX detail contract. Metadata for an old slug is already canonicalized to the current page and uses the same bounded helper, whose distance/year suffix and middle truncation retain the distinguishing end of long format names.
- Canonical and redirected web reads share the same service-only durable web flag and explicit parent-event projection. Adding searchable city, department, region, and country labels does not change direct-client RLS or expose organizer JSON, codes, or coordinates.
- The parent-event projection now also allowlists `website_url` for the registration CTA after canonical resolution. It remains presentation metadata and does not participate in redirect visibility or slug identity.

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
- Do not return a server-resolved web redirect after `is_public`, `web_catalog_is_live`, or the parent-event gate is cleared. Mobile/private or edition-hidden states alone deliberately keep the indexed web redirect resolvable.
- Do not point one redirect at another slug. Always resolve through `race_id` to the current canonical slug.
- The migration is versioned locally but has not been applied to a remote database by this change.

## Related Docs

- [races](races.md)
- [race_events](race-events.md)
- [Public Race Discovery](../../03-business-rules/public-race-discovery.md)
- [RLS Policies](../rls-policies.md)
- [Migrations](../migrations.md)
