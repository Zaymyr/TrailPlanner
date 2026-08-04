---
title: race_event_publication_requests Table
scope: database
last_verified: 2026-08-04
ai_priority: high
related_files:
  - supabase/migrations/20260729110000_add_race_event_publication_requests.sql
  - apps/web/lib/organizer-publication.ts
  - apps/web/app/api/organizer/publication-requests/route.ts
  - apps/web/app/api/organizer/publication-requests/route.test.ts
  - apps/web/app/api/admin/event-publication-requests/route.ts
  - apps/web/app/api/admin/event-publication-requests/route.test.ts
  - apps/web/app/api/organizer/claims/route.ts
  - apps/web/app/organizer/_components/OrganizerDashboard.tsx
  - apps/web/app/organizer/_components/dashboard/types.ts
  - apps/web/app/organizer/_components/dashboard/shell.tsx
  - apps/web/app/admin/_components/AdminOrganizerClaimsTab.tsx
related_tables:
  - race_event_publication_requests
  - race_event_organizers
  - race_events
  - races
---

# `race_event_publication_requests`

## Purpose

This table is the sole content-review gate for the current organizer creation flow. Organizers freely maintain draft events, editions, and formats, then request admin publication at event level.

## Columns

| Column | Type | Purpose |
| --- | --- | --- |
| `id` | `uuid` | Request identifier. |
| `created_at`, `updated_at` | `timestamptz` | Audit timestamps. |
| `user_id` | `uuid` | Organizer who requested publication. |
| `event_id` | `uuid` | Event to publish. |
| `status` | `text` | `pending`, `approved`, or `rejected`. |
| `reviewed_by`, `reviewed_at`, `reviewer_notes` | nullable audit fields | Admin review metadata. |

## Authorization

- An authenticated user may insert and read their own request only when they have an active `race_event_organizers` membership for the event.
- Only one pending request may exist per event.
- Admin review is performed by a service-role API after trusted `app_metadata` admin authentication.
- `review_race_event_publication_request` is invoker-security and executable only by `service_role`; approval rechecks readiness, publishes the event and complete formats, then closes the request atomically.

## Business Invariants

- Organizer event/race routes never accept direct `is_live` changes.
- A request requires event name, location, start date, end date, and at least one format with name, positive distance, and non-negative elevation gain.
- Organizer GPX replacement persists parsed distance and elevation on `races` and immediately mirrors those exact values into the active form, so readiness shown before a publication request matches the stored format row.
- Rejection leaves all source rows unchanged.
- Approval publishes complete formats under the event. Incomplete formats remain drafts and can be submitted in a later request after completion.
- Publication does not send runner notifications automatically.

## Gotchas

- This is a publication review, not an ownership claim. Legacy claims may still protect access to pre-existing catalog events.
- Recheck readiness during admin approval because organizers can edit source data while a request is pending.
- Keep publication readiness sourced from persisted race values; client-side GPX form synchronization is only immediate feedback and does not bypass server-side revalidation.
- New public-schema tables require explicit grants as well as RLS.

## Related Docs

- [Organizer Race Management](../../03-business-rules/organizer-race-management.md)
- [race_event_organizers](race-event-organizers.md)
- [RLS Policies](../rls-policies.md)
