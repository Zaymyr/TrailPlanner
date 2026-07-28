---
title: race_event_edition_requests Table
scope: database
last_verified: 2026-07-28
ai_priority: high
related_files:
  - supabase/migrations/20260721110000_add_race_event_edition_requests.sql
  - supabase/tests/organizer_rls_checks.sql
  - apps/web/app/api/organizer/claims/route.ts
  - apps/web/app/api/organizer/edition-requests/route.ts
  - apps/web/app/api/admin/organizer-claims/route.ts
  - apps/web/app/organizer/_components/OrganizerDashboard.tsx
  - apps/web/app/organizer/_components/dashboard/shell.tsx
  - apps/web/app/admin/_components/AdminOrganizerClaimsTab.tsx
related_tables:
  - race_event_edition_requests
  - race_events
  - race_event_organizers
---

# `race_event_edition_requests`

## Purpose

`race_event_edition_requests` stores organizer requests to open a new yearly event edition. The request is review-gated for billing/ops reasons: organizers cannot create the new year directly from the dashboard, and the `races` cloning happens only when an admin approves the request.

## Key Concepts

- Edition request: organizer request for one event and one requested start date.
- Source year: currently selected event edition year the organizer wants to renew.
- Review gate: admin approval or rejection before any yearly edition can be created operationally.
- Status: `pending`, `approved`, or `rejected`.

## Columns

| Column | Type | Constraints/default | Purpose |
| --- | --- | --- | --- |
| `id` | `uuid` | primary key, default `gen_random_uuid()` | Request id. |
| `created_at` | `timestamptz` | not null, default UTC `now()` | Creation time. |
| `updated_at` | `timestamptz` | not null, trigger-maintained | Last update time. |
| `user_id` | `uuid` | not null, references `auth.users(id)` on delete cascade | Organizer asking for the new edition. |
| `event_id` | `uuid` | not null, references `race_events(id)` on delete cascade | Event being renewed. |
| `source_year` | `integer` | not null | Currently selected edition year used as the renewal source context. |
| `requested_start_date` | `date` | not null | Requested start date for the next edition. |
| `status` | `text` | not null, default `pending`, check constraint | Review status. |
| `reviewed_by` | `uuid` | nullable, references `auth.users(id)` on delete set null | Admin reviewer. |
| `reviewed_at` | `timestamptz` | nullable | Review timestamp. |
| `reviewer_notes` | `text` | nullable | Internal review note. |

## Foreign Keys

- `user_id -> auth.users(id) on delete cascade`
- `event_id -> public.race_events(id) on delete cascade`
- `reviewed_by -> auth.users(id) on delete set null`

## Indexes

- `race_event_edition_requests_user_idx` on `(user_id, created_at desc)`
- `race_event_edition_requests_event_idx` on `(event_id, status, requested_start_date desc)`
- `race_event_edition_requests_open_event_date_idx` unique on `(event_id, requested_start_date)` where `status in ('pending', 'approved')`

## RLS Policies

Summary:

- Authenticated users can insert pending requests only for their own `user_id`.
- Users can read only their own requests.
- Admins can read and update requests through trusted `app_metadata`.

## Business Invariants

- A `pending` request is not a created edition yet.
- One event cannot keep multiple pending/approved requests for the same requested start date.
- The organizer dashboard may expose the request action only to approved event organizers; unrelated dashboard dialogs, including the scrollable website-import recap, its editable event-date correction, and its per-format confidence scores, do not change that edition-request gate or create a new yearly edition.
- A locked past edition does not reopen direct editing rights; organizers still request the next edition through this table instead of mutating the expired edition.
- Admin approval is the business validation step that also clones the source-year `races`, ravitos, station-product links, and GPX files into the requested year.

## Gotchas

- Do not bypass this table by creating yearly editions directly from the organizer dashboard.
- Do not treat `pending` as proof that race rows already exist for that year; only an approved request should materialize the cloned edition rows.
- Keep organizer/admin copy aligned: the organizer sends a request, the admin validates it, and only then can the business process continue.
- Keep the admin review surface explicit: edition requests stay visually distinct from access claims, while still showing the organizer identity when it is available.
- If this table or its event join is unavailable in one environment, the admin organizer tab should degrade to an empty edition-request section rather than failing the whole review screen.

## Related Docs

- [race_events](race-events.md)
- [race_event_organizers](race-event-organizers.md)
- [Organizer Race Management](../../03-business-rules/organizer-race-management.md)
