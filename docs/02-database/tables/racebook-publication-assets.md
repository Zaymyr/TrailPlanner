---
title: racebook_publication_assets
scope: database
last_verified: 2026-11-03
ai_priority: high
related_files:
  - supabase/migrations/20261103112225_racebook_versioned_publications.sql
  - supabase/tests/racebook_versioned_publications_checks.sql
  - apps/web/lib/racebook-publications.ts
related_tables:
  - racebook_publication_assets
  - racebook_publications
  - racebook_publication_asset_cleanup_queue
---

# `racebook_publication_assets`

## Purpose

Pins every GPX, image or logo used by a retained RaceBook publication so draft replacements cannot remove files still required by history or the current snapshot.

## Key Concepts

An asset has either a private Storage bucket/path pair, a public HTTPS URL, or both. Rows cascade only when their publication is pruned.

The organizer publication confirmation reports GPX and image/logo differences from the canonical snapshot while these rows remain the authoritative retained-file references after publication.

## Columns

| Column | Rules | Meaning |
| --- | --- | --- |
| `id` | UUID PK | Reference identity. |
| `publication_id` | cascading publication FK | Owning snapshot. |
| `asset_type` | allowlisted text | GPX/image/logo role. |
| `storage_bucket`, `storage_path` | nullable paired values | Private Storage identity. |
| `public_url` | nullable HTTPS URL | Externally hosted asset identity. |
| `created_at` | UTC timestamp | Reference creation. |

## Foreign Keys

`publication_id` cascades from `racebook_publications`.

## Indexes

The Storage pair index supports reference checks. A null-safe unique constraint prevents duplicate references inside one publication.

## RLS Policies

Service-only RLS and revoked client grants match the publication tables.

## Business Invariants

Storage cleanup is queued only when no retained publication references the same bucket/path pair.

## Common Queries

```sql
select asset_type, storage_bucket, storage_path
from racebook_publication_assets
where publication_id = :publication_id;
```

## Gotchas

- Public URLs are references, not deletion jobs.
- Do not delete a Storage object merely because a draft URL changed.

## Related Docs

- [racebook_publications](racebook-publications.md)
- [cleanup queue](racebook-publication-asset-cleanup-queue.md)

