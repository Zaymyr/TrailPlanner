---
title: racebook_publication_states
scope: database
last_verified: 2026-11-03
ai_priority: high
related_files:
  - supabase/migrations/20261103123918_racebook_versioned_publications.sql
  - supabase/migrations/20261103124133_index_racebook_publication_foreign_keys.sql
  - supabase/migrations/20261103124538_cover_racebook_current_publication_foreign_key.sql
  - supabase/tests/racebook_versioned_publications_checks.sql
  - apps/web/lib/racebook-publications.ts
related_tables:
  - racebook_publication_states
  - racebook_publications
  - races
---

# `racebook_publication_states`

## Purpose

Stores the mutable draft/publication cursor for each edition-backed RaceBook format. Draft source tables remain editable; runner reads use `current_publication_id` only.

## Key Concepts

- `draft_revision` increases when RaceBook source content changes.
- `published_source_revision` records the draft revision used by the current immutable snapshot.
- The two revisions differing means there are unpublished changes.
- The organizer list reads this lightweight state for every format; the heavier draft-versus-snapshot field comparison runs only when the publication confirmation is opened.

## Columns

| Column | Rules | Meaning |
| --- | --- | --- |
| `race_id` | PK, cascading race FK | Format identity. |
| `event_id`, `edition_id` | required cascading FKs | Denormalized parent scope, constrained with the current publication. |
| `draft_revision` | bigint, at least 1 | Current draft generation. |
| `current_publication_id` | nullable publication FK | Snapshot served to runners. |
| `published_source_revision` | nullable bigint | Draft generation captured by the current snapshot. |
| `last_published_at`, `last_published_by` | nullable audit fields | Latest publication action. |
| `created_at`, `updated_at` | UTC timestamps | State audit. |

## Foreign Keys

The race, event and edition delete cascades remove the state. The composite current-publication FK prevents pointing at another format or edition.

## Indexes

Edition/event indexes support bulk status reads. A partial dirty index covers states with no publication or mismatched revisions.

## RLS Policies

RLS is enabled without client policies. `anon` and `authenticated` have no privileges. Server routes use `service_role` after session and organizer-membership checks.

## Business Invariants

Source triggers initialize states and increment the revision. Visibility, analytics counters and publication metadata are excluded. Shared event/edition edits increment every attached format.

## Common Queries

```sql
select draft_revision, published_source_revision, current_publication_id
from racebook_publication_states
where race_id = :race_id;
```

## Gotchas

- Do not expose this table directly to mobile clients.
- A restored snapshot keeps its original source revision, so a newer draft remains visibly dirty.
- Draft autosave must not move `current_publication_id`.

## Related Docs

- [racebook_publications](racebook-publications.md)
- [RLS Policies](../rls-policies.md)

