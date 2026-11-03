---
title: racebook_publications
scope: database
last_verified: 2026-11-03
ai_priority: high
related_files:
  - supabase/migrations/20261103123918_racebook_versioned_publications.sql
  - supabase/migrations/20261103124133_index_racebook_publication_foreign_keys.sql
  - supabase/tests/racebook_versioned_publications_checks.sql
  - apps/web/lib/racebook-publications.ts
  - apps/web/app/api/racebook-data/route.ts
related_tables:
  - racebook_publications
  - racebook_publication_states
  - racebook_publication_assets
---

# `racebook_publications`

## Purpose

Stores immutable, versioned RaceBook snapshots assembled and validated by the server. Public APIs resolve the current snapshot through `racebook_publication_states` rather than joining draft tables.

## Key Concepts

- Versions are monotone per format.
- `schema_version` versions the JSON contract; `content_hash` is the canonical SHA-256 digest.
- Publication and bulk publication compare an expected draft revision while holding the state row lock.
- Before a single-format confirmation, the server builds the saved draft snapshot and compares its canonical sections with the current publication to return human-readable changed-field labels; this comparison does not insert a version.

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

## Related Docs

- [racebook_publication_states](racebook-publication-states.md)
- [racebook_publication_assets](racebook-publication-assets.md)

