---
title: race_event_organizers Table
scope: database
last_verified: 2026-06-25
ai_priority: high
related_files:
  - supabase/migrations/20260528120000_add_organizer_portal.sql
  - supabase/migrations/20260618160000_add_organizer_dashboard_details.sql
  - apps/web/lib/organizer.ts
  - apps/web/lib/organizer-dashboard-details.ts
  - apps/web/app/api/admin/organizer-claims/route.ts
  - apps/web/app/api/organizer/events/[id]/route.ts
  - apps/web/app/api/organizer/events/[id]/route.test.ts
  - apps/web/app/api/organizer/events/[id]/image/route.ts
  - apps/web/app/api/organizer/events/[id]/image/route.test.ts
  - apps/web/app/api/organizer/races/route.ts
  - apps/web/app/api/organizer/races/[id]/route.ts
  - apps/web/app/api/organizer/races/[id]/route.test.ts
  - apps/web/app/api/organizer/races/[id]/image/route.ts
  - apps/web/app/api/organizer/races/[id]/image/route.test.ts
  - apps/web/app/api/organizer/races/[id]/gpx/route.ts
  - apps/web/app/api/organizer/races/[id]/gpx/route.test.ts
  - apps/web/app/api/organizer/races/[id]/aid-stations/route.ts
  - apps/web/app/api/organizer/races/[id]/aid-stations/route.test.ts
  - apps/web/app/api/organizer/races/[id]/aid-station-products/route.ts
related_tables:
  - race_event_organizers
  - race_event_claims
  - race_events
  - races
---

# `race_event_organizers`

## Purpose

`race_event_organizers` grants organizer access to a whole `race_events` row and all of its `races` formats. This is the authorization source for approved organizers.

## Key Concepts

- Event membership: organizer access is event-scoped, not race-row ownership.
- Source edit access: active memberships authorize event, format, GPX, aid station service-flag, organizer JSONB detail, and station-product edits through server routes.
- Revocation: `revoked_at` disables membership without deleting audit history.
- Claim provenance: `claim_id` links membership back to the approved claim when available.
- Public catalog preservation: claimed public races are not tied to `races.created_by`.

## Columns

| Column | Type | Constraints/default | Purpose |
| --- | --- | --- | --- |
| `id` | `uuid` | primary key, default `gen_random_uuid()` | Membership id. |
| `created_at` | `timestamptz` | not null, default UTC `now()` | Creation time. |
| `event_id` | `uuid` | not null, references `race_events(id)` on delete cascade | Managed event. |
| `user_id` | `uuid` | not null, references `auth.users(id)` on delete cascade | Organizer user. |
| `claim_id` | `uuid` | nullable, references `race_event_claims(id)` on delete set null | Approved claim that created the membership. |
| `role` | `text` | not null, default `owner` | Event role label. |
| `created_by` | `uuid` | nullable, references `auth.users(id)` on delete set null | Admin that granted access. |
| `revoked_at` | `timestamptz` | nullable | Revocation timestamp. |
| `revoked_by` | `uuid` | nullable, references `auth.users(id)` on delete set null | Admin that revoked access. |
| `revoke_reason` | `text` | nullable | Internal revocation reason. |

## Foreign Keys

- `event_id -> public.race_events(id) on delete cascade`
- `user_id -> auth.users(id) on delete cascade`
- `claim_id -> public.race_event_claims(id) on delete set null`
- `created_by -> auth.users(id) on delete set null`
- `revoked_by -> auth.users(id) on delete set null`

## Indexes

- `race_event_organizers_user_idx` on `user_id`
- `race_event_organizers_event_idx` on `event_id`
- `race_event_organizers_active_user_event_idx` unique on `(user_id, event_id)` where `revoked_at is null`

## RLS Policies

See [../rls-policies.md](../rls-policies.md).

Summary:

- Users can read their own organizer memberships.
- Admins can read and manage memberships using trusted `app_metadata`.
- Child organizer policies check active membership with `revoked_at is null`.

## Business Invariants

- Approved organizer writes must check an active membership for the parent event.
- A membership grants access to all formats under the event.
- A membership grants access to source ravito service flags (`water_available`, `solid_available`, `assistance_allowed`) for all formats under the event.
- A membership grants service-route access to organizer detail JSONB on the event, its formats, and its source ravitos. Event JSONB stores common defaults and the event end date; race JSONB stores active-format differences or additions, including the current access-section toggles used by the organizer dashboard.
- A membership grants service-route access to upload the event PNG thumbnail, upload a format thumbnail, preview/replace format GPX files, and delete a format for every race under the event.
- A membership authorizes organizer station-product edits, including catalog-product picker attachments and organizer-scoped product creation, only for stations under the managed event.
- Claimed public races should keep `races.created_by = null` unless they were user-private races for another flow.
- Revocation should set `revoked_at` instead of deleting the row.

## Common Queries

Check active membership for an event:

```sql
select 1
from public.race_event_organizers
where event_id = '<event-id>'
  and user_id = auth.uid()
  and revoked_at is null;
```

Fetch active organizers for an event:

```sql
select id, user_id, role, created_at
from public.race_event_organizers
where event_id = '<event-id>'
  and revoked_at is null
order by created_at asc;
```

## Gotchas

- Do not authorize organizer edits with `races.created_by`; claimed catalog races deliberately avoid user ownership.
- Do not physically delete public race/event rows when an organizer account is deleted or revoked.
- JWT admin checks must use `app_metadata`, not `user_metadata`.
- New organizer-facing fields on child source tables should continue to check active membership for the parent event.
- Organizer dashboard JSONB fields do not change the membership model; keep using active `race_event_organizers` checks instead of field-level shortcuts.
- Common-vs-format detail splitting is an application convention, not a new authorization boundary.
- The current organizer UI treats bib pickup as event-only, and treats format access-section toggles plus ravito start/finish timing cards as ordinary race-detail edits; all of them still rely on the same active event-membership check.
- Product picker UI does not grant access by itself; station-product API routes must keep checking active event membership before replacing product links.
- Event image, race image, race delete, and GPX routes are also source mutations/reads and must keep checking active event membership.
- Format deletion must still preserve saved runner plans through the `race_plans.race_id` foreign-key behavior; organizer membership grants source delete access, not plan deletion rights.

## Related Docs

- [race_event_claims](race-event-claims.md)
- [race_events](race-events.md)
- [Relationships](../relationships.md)
- [Organizer Race Management](../../03-business-rules/organizer-race-management.md)
