---
title: racebook_publication_asset_cleanup_queue
scope: database
last_verified: 2026-11-03
ai_priority: medium
related_files:
  - supabase/migrations/20261103112225_racebook_versioned_publications.sql
  - supabase/tests/racebook_versioned_publications_checks.sql
  - apps/web/app/api/admin/racebook-publications/cleanup/route.ts
  - apps/web/app/api/admin/racebook-publications/cleanup/route.test.ts
related_tables:
  - racebook_publication_asset_cleanup_queue
  - racebook_publication_assets
---

# `racebook_publication_asset_cleanup_queue`

## Purpose

Stores retryable asynchronous deletion work for private Storage objects no longer referenced by any retained publication.

## Key Concepts

Publication pruning enqueues; the protected admin maintenance route processes up to 25 available jobs, rechecks retained references, deletes Storage objects, and records exponential retry state. Database publication never waits on Storage deletion.

## Columns

| Column | Rules | Meaning |
| --- | --- | --- |
| `id` | UUID PK | Job identity. |
| `storage_bucket`, `storage_path` | unique pair | Exact deletion target. |
| `status` | pending/processing/failed/deleted | Retry lifecycle. |
| `attempt_count`, `available_at`, `last_attempt_at`, `last_error` | retry fields | Worker coordination. |
| `created_at`, `completed_at` | timestamps | Audit lifecycle. |

## Foreign Keys

None: the queue must survive deletion of the publication and asset reference that created it.

## Indexes

A partial availability index covers pending and failed jobs.

## RLS Policies

Service-only RLS; no browser/mobile grants or policies.

## Business Invariants

Completed jobs require `completed_at`. Re-enqueuing a previously deleted path returns it to pending if a later publication lifecycle makes deletion necessary again.

## Common Queries

```sql
select *
from racebook_publication_asset_cleanup_queue
where status in ('pending', 'failed') and available_at <= now()
order by available_at, created_at;
```

## Gotchas

- Workers must recheck retained references before physical deletion because a path can be reused after enqueue.
- Schedule the protected cleanup route from trusted infrastructure; it is idempotent and never exposes queue paths to clients.
- Never send bucket/path values to public clients.

## Related Docs

- [racebook_publication_assets](racebook-publication-assets.md)
- [RLS Policies](../rls-policies.md)
