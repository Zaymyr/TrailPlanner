---
title: race_slug_redirects Table
scope: database
last_verified: 2026-11-23
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

The public course page may add a summary-only ravito timeline and an app bridge after canonical slug resolution. Neither surface changes the redirect lookup, reserved-slug invariant, or current-race visibility recheck.

Public course details can now show additive third-party bib-pickup conditions. Canonical slug resolution, former-slug redirects, visibility checks, and redirect integrity are unchanged.

Catalogue data quality (2026-11-22): after canonical resolution the page marks the Trail TST demo `noindex,follow` (metadata `robots`) without official links or `SportsEvent`, drops `eventStatus`/`Offer` for finished formats, hides placeholder D− values and writes description distances with a French decimal comma. A former slug of a demo format still redirects the same way; slug identity, reservations and visibility rechecks are unchanged.

Event hubs (2026-11-22): `lib/public-races.ts` adds the parent event's hub slug (`eventSlug`, separate lenient `race_events?select=id,slug` read) and the derived `regionSlug` to the catalog DTO; the course breadcrumb links the hub. Format slug resolution, former-slug redirects and visibility rechecks are unchanged.

## Purpose

`race_slug_redirects` preserves every former public course slug so indexed URLs and inbound links can permanently redirect to the current `races.slug`.

This table is format-scoped. Event-edition URLs use the separate service-only `race_event_edition_slug_redirects` table and never resolve through a format redirect.

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
- The public web route returns a permanent redirect only after reloading the target through the current public visibility gates, and it redirects before loading the richer organizer/GPX detail contract. Metadata for an old slug is already canonicalized to the current page and uses the same bounded helper, whose distance/year suffix and middle truncation retain the distinguishing end of long format names. Since 2026-11-16 metadata also reads the cached public detail of the resolved target to add reference finishing times to the description; this happens after resolution and never affects redirect lookup.
- No slug is pre-rendered during deployment. Current and former slugs resolve on first request through dynamic ISR, so preserving redirect checks does not require rebuilding every public detail page.
- Canonical and redirected web reads share the same service-only durable web flag and explicit parent-event projection. Adding searchable city, department, region, and country labels does not change direct-client RLS or expose organizer JSON, codes, or coordinates.
- The parent-event projection now also allowlists `website_url` for the registration CTA after canonical resolution. It remains presentation metadata and does not participate in redirect visibility or slug identity.
- Canonical and former-slug reads carry the shared public catalog cache tag. Successful public-facing writes invalidate that tag after persistence, while redirect identity and visibility rechecks remain unchanged.

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

The canonical page reached after a slug redirect keeps the same metadata rules; course titles now prefix generic format names with their event name (`Event — Format`). Redirect resolution is unchanged.

Format pages (2026-11-23) gained a related-guides block; slug resolution and redirects are unchanged.
