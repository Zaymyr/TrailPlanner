---
title: racebook_publications
scope: database
last_verified: 2026-11-15
ai_priority: high
related_files:
  - apps/web/lib/supporter-guide.ts
  - apps/web/lib/supporter-guide.test.ts
  - apps/web/app/api/supporter-guide/route.ts
  - apps/web/lib/racebook-publication-checks.ts
  - apps/web/lib/racebook-partner-slots.ts
  - supabase/migrations/20261103123918_racebook_versioned_publications.sql
  - supabase/migrations/20261103124133_index_racebook_publication_foreign_keys.sql
  - supabase/tests/racebook_versioned_publications_checks.sql
  - apps/web/lib/racebook-publications.ts
  - apps/web/app/api/racebook-data/route.ts
  - apps/web/lib/racebook-public-data.ts
  - apps/web/lib/plan-share-race-context.ts
related_tables:
  - racebook_publications
  - racebook_publication_states
  - racebook_publication_assets
---

# `racebook_publications`

The Supporter Guide timeline adds `arrival_estimate` entries (official start + estimated winning time, `audience` men/women, multi-day aware) and event-wide `animation` entries (`eventWide`, `endTime`, `animationType`) shown whatever races are followed; Programme gains an Animations tab and the Arrivées tab groups expected first arrivals with the last-runner finish cutoff. Values come from the published snapshot's race and event organizer JSON.

Supporter Guide places (2026-11-15): the payload adds `formats[].stops`, built server-side by `buildSupporterStops` — an aid station and supporter points sharing the same normalized place name (accents, case, punctuation ignored, « St »/« Ste » = Saint/Sainte) within 2 km become one stop carrying every role (ravito, encouragement, assistance), the supporter access rule, services, cutoff and directions. Start timeline entries carry `mapsUrl` (start area directions). Both fields are additive on `schemaVersion: 1`. Reads still come only from immutable publications.

The Supporter Guide payload (`apps/web/lib/supporter-guide.ts`) stays additive on `schemaVersion: 1`: formats are sorted by date then first start; station and finish cutoffs are resolved from the official departure with the shared `racebook-cutoffs` resolver (organizer wording such as « sam. 15h » or « dim. 15/11 à 14h » becomes `{ date, time, dayOffset }` instead of being truncated); it also adds `timeline` (dated starts, finish cutoffs, podiums), `elevationGainM`, station `waterAvailable` / `solidAvailable` / `isFinish` and access `note`. Reads still come only from immutable publications.

The Supporter Guide aggregator reads only current immutable publications for preview-visible formats in one edition. It applies the same effective-module masking as `/api/racebook-data`; an event with no qualifying publication is unavailable and never falls back to drafts. The additive `supporter_guide` module key defaults to enabled only for legacy snapshots that predate the key.

Published RaceBook payloads resolve exact module gifts alongside the edition plan. Manual invoice status, due dates and settlement are not publication authority and are never used to unlock a RaceBook.

## Purpose

Stores immutable, versioned RaceBook snapshots assembled and validated by the server. Public APIs resolve the current snapshot through `racebook_publication_states` rather than joining draft tables.

## Key Concepts

- Versions are monotone per format.
- `schema_version` versions the JSON contract; `content_hash` is the canonical SHA-256 digest.
- Publication and bulk publication compare an expected draft revision while holding the state row lock.
- Before a single-format confirmation, the server builds the saved draft snapshot and compares its canonical sections with the current publication to return human-readable changed-field labels; this comparison does not insert a version.
- The organizer state read uses the same canonical SHA-256 comparison whenever revisions differ. Thus, a draft that is changed and then restored to byte-equivalent canonical content is not reported as unpublished merely because source revisions are monotonic.

## Columns

| Column | Rules | Meaning |
| --- | --- | --- |
| `id` | UUID PK | Snapshot identity. |
| `race_id`, `event_id`, `edition_id` | required cascading FKs | Snapshot scope. |
| `version` | positive, unique per race | Display/history version. |
| `schema_version` | positive integer | Payload contract version. |
| `content` | JSON object | Validated canonical snapshot. |
| `content_hash` | 64 lowercase hex characters | Canonical SHA-256 digest. |
| `source_draft_revision` | positive bigint | Draft generation captured. |
| `published_by`, `published_at` | nullable actor, required timestamp | Audit facts. |
| `restored_from_publication_id` | nullable UUID provenance | Source of a restore; intentionally survives source pruning. |

## Foreign Keys

Race, event and edition deletion cascade. Restoration provenance is deliberately not an FK because the source can leave the ten-version retention window.

## Indexes

The race/version unique key serializes version identity. Race and edition timestamp indexes support history.

## RLS Policies

RLS is enabled with no client policies. `service_role` can select, insert and delete for retention, but receives no update grant. Publication RPCs are `SECURITY INVOKER` and executable only by `service_role`.

## Business Invariants

- A publish inserts a new row, inserts its asset references, then moves the state pointer atomically.
- Bulk publication preflights and locks every expected revision before inserting any snapshot.
- Restore copies an old payload into a new version and never overwrites draft source tables.
- Only the ten newest versions per race are retained.
- `loadPublishedRacebookData` is the shared effective-module normalizer for the public RaceBook endpoint and authenticated followed-plan context. The latter first requires current public race/event visibility and never falls back to source tables when no publication exists.

## Common Queries

```sql
select version, published_at, published_by, restored_from_publication_id
from racebook_publications
where race_id = :race_id
order by version desc
limit 10;
```

## Gotchas

- Never serialize service-only asset paths in a public response.
- A PostgreSQL `PT409` revision error is the concurrency signal; keep the previous pointer unchanged.
- Publication content is immutable by grants, not by an update trigger, so privileged maintenance must preserve that contract.
- `content_hash` is the authoritative content-equality signal for organizer dirty presentation when both a built draft snapshot and a current publication exist; revision values still protect publish-time concurrency.

## Related Docs

- [racebook_publication_states](racebook-publication-states.md)
- [racebook_publication_assets](racebook-publication-assets.md)

## Partner slots and publication checks (2026-11-09)

Snapshot schema version 1 gains an optional `partnerSlots` array (`{ slot, mode, partner }`, partner with sponsor id, name, logo, destination and headline). It is filled only when the effective `sponsors` module is on; absent in older rows, it parses to `[]` (affiliate defaults). Partner logos join `assets.imageUrls`; `publicSnapshot` strips `destinationUrl`. Change descriptions list `Emplacements partenaires`. Publication routes run the pre-publication checks on the built snapshot and refuse blocking issues with 409 before calling `publish_racebook_snapshot(s)`; the RPCs and stored columns are unchanged.
