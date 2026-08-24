---
title: organizer_import_sessions Table
scope: database
last_verified: 2026-08-24
ai_priority: high
related_files:
  - supabase/migrations/20260824114439_add_organizer_import_sessions_and_drafts.sql
  - supabase/tests/organizer_import_sessions_checks.sql
  - apps/web/lib/organizer-import-sessions.ts
  - apps/web/app/api/organizer/events/[id]/website-import/route.ts
  - apps/web/app/api/cron/organizer-import-cleanup/route.ts
related_tables:
  - organizer_import_sessions
  - race_events
  - race_event_editions
  - races
  - race_aid_stations
---

# `organizer_import_sessions`

## Purpose

`organizer_import_sessions` stores temporary, service-only state for the two-pass Organizer import: format confirmation first, then field review and application.

## Key Concepts

- Session scope: exactly one event and one canonical edition.
- Temporary evidence: source manifests and snapshots expire after two hours by default.
- Confirmed format map: stable `formatKey` and its signed `candidateKeys` to persisted `raceId` bindings used by the field pass. Keeping that mapping inside the confirmation RPC makes draft creation and session advancement atomic.
- Service boundary: browser roles never read or mutate this table or execute its RPCs directly.

## Columns

| Column | Type | Rules | Meaning |
| --- | --- | --- | --- |
| `id` | `uuid` | primary key | Import session id. |
| `event_id` | `uuid` | non-null FK | Selected organizer event. |
| `edition_id` | `uuid` | non-null FK | Selected edition; a trigger verifies that it belongs to `event_id`. |
| `created_by` | `uuid` | non-null FK | Trusted admin who started the import. |
| `status` | `text` | constrained state | `discovered`, `formats_confirmed`, `fields_analyzed`, `applied`, or `cancelled`. |
| `source_manifest` | `jsonb` | object | Bounded URLs plus temporary document Storage paths. |
| `discovery_snapshot` | `jsonb` | object | Canonical first-pass discovery evidence. |
| `confirmed_formats` | `jsonb` | array | Confirmed `formatKey`, `candidateKeys`, `raceId`, name, mode, status, and missing-field bindings. |
| `field_snapshot` | `jsonb` | object | Canonical field claims and review state. |
| `expires_at` | `timestamptz` | after creation | Cleanup deadline, two hours by default. |
| `created_at`, `updated_at` | `timestamptz` | non-null | Audit timestamps. |

## Foreign Keys

- `event_id -> race_events(id) on delete cascade`
- `edition_id -> race_event_editions(id) on delete cascade`
- `created_by -> auth.users(id) on delete cascade`

Deleting an event, edition, or initiating user removes its temporary sessions. The scope trigger prevents cross-event edition bindings.

## Indexes

- `organizer_import_sessions_event_id_idx`
- `organizer_import_sessions_edition_id_idx`
- `organizer_import_sessions_created_by_idx`
- `organizer_import_sessions_expires_at_idx`
- Partial active-session index on `(event_id, edition_id, created_at desc)` for discovery, confirmation, and analysis states.

## RLS Policies

RLS is enabled with no client policy. All table privileges are revoked from `PUBLIC`, `anon`, and `authenticated`; only `service_role` receives select/insert/update/delete.

The two mutation RPCs are `SECURITY INVOKER`, have `search_path = ''`, revoke execute from client roles, and grant execute only to `service_role`:

- `confirm_organizer_import_formats(uuid, jsonb)` atomically binds existing formats and creates confirmed incomplete formats as hidden drafts.
- `apply_organizer_import_field_patches(uuid, jsonb, jsonb)` atomically applies allowlisted event/race fields and any explicitly selected aid-station replacement.

## Business Invariants

- A session cannot outlive its cleanup deadline for confirmation or apply.
- Confirmation is accepted only from `discovered`; apply is accepted only from `formats_confirmed` or `fields_analyzed`.
- A race patch can target only a `raceId` recorded in the session's `confirmed_formats` and still attached to its event/edition.
- Unknown JSON keys, duplicate targets, invalid types, and over-limit arrays reject the entire RPC transaction.
- Applying `aidStations` replaces the full station set only when that key is present; omission leaves stations untouched.
- The hourly `organizer-import-cleanup-hourly` pg_cron job calls the web cleanup route. The route removes Storage objects before deleting expired rows; SQL never deletes `storage.objects` directly.

## Common Queries

Create a discovered session from a trusted service route:

```sql
insert into public.organizer_import_sessions (
  event_id, edition_id, created_by, source_manifest, discovery_snapshot
)
values (:event_id, :edition_id, :admin_id, :source_manifest, :discovery_snapshot)
returning id, status, expires_at;
```

Fetch expired cleanup work:

```sql
select id, source_manifest
from public.organizer_import_sessions
where expires_at <= timezone('utc', now())
order by expires_at;
```

## Gotchas

- Do not expose session snapshots through direct authenticated Data API grants.
- Parse session `timestamptz` values with ISO offset support: PostgREST may serialize UTC as `+00:00` instead of `Z`.
- Do not accept client-provided database values outside the RPC allowlists.
- Do not delete expired rows before their temporary Storage objects have been removed.
- Explicit aid-station replacement changes station ids and cascades existing `race_aid_station_products` links; the review must make that replacement visible to the admin.
- `configure_organizer_import_cleanup_cron()` requires Vault secrets named `web_app_url` and `cron_secret`; it skips scheduling with a notice when either is absent.

## Related Docs

- [races](races.md)
- [race_events](race-events.md)
- [race_event_editions](race-event-editions.md)
- [RLS Policies](../rls-policies.md)
- [Organizer Race Management](../../03-business-rules/organizer-race-management.md)
