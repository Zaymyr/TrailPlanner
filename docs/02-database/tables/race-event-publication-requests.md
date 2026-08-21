---
title: race_event_publication_requests Table
scope: database
last_verified: 2026-08-21
ai_priority: high
related_files:
  - supabase/migrations/20260729110000_add_race_event_publication_requests.sql
  - supabase/migrations/20260820135823_add_racebook_publication_control.sql
  - supabase/migrations/20260820164141_target_racebook_publication_requests.sql
  - apps/web/lib/organizer-publication.ts
  - apps/web/app/api/organizer/publication-requests/route.ts
  - apps/web/app/api/organizer/publication-requests/route.test.ts
  - apps/web/app/api/organizer/publication-requests/readiness.test.ts
  - apps/web/app/api/admin/event-publication-requests/route.ts
  - apps/web/app/api/admin/event-publication-requests/route.test.ts
  - apps/web/app/api/organizer/claims/route.ts
  - apps/web/app/organizer/_components/OrganizerDashboard.tsx
  - apps/web/app/organizer/_components/dashboard/types.ts
  - apps/web/app/organizer/_components/dashboard/shell.tsx
  - apps/web/app/admin/_components/AdminOrganizerClaimsTab.tsx
related_tables:
  - race_event_publication_requests
  - race_event_editions
  - race_event_organizers
  - race_events
  - races
---

# `race_event_publication_requests`

## Purpose

This table is the sole first-publication review gate for organizer Racebooks. Courses remain visible in the catalog; each new request targets the exact format whose Racebook the organizer wants to publish, independently from the event's current edition and its other formats.

## Columns

| Column | Type | Purpose |
| --- | --- | --- |
| `id` | `uuid` | Request identifier. |
| `created_at`, `updated_at` | `timestamptz` | Audit timestamps. |
| `user_id` | `uuid` | Organizer who requested publication. |
| `event_id` | `uuid` | Event to publish. |
| `race_id` | nullable `uuid` | Exact requested format; null is retained only for legacy event-level requests. |
| `status` | `text` | `pending`, `approved`, or `rejected`. |
| `reviewed_by`, `reviewed_at`, `reviewer_notes` | nullable audit fields | Admin review metadata. |

## Authorization

- An authenticated user may insert and read their own request only when they have an active `race_event_organizers` membership for the event.
- Only one pending request may exist per format; different formats of the same event may be reviewed independently.
- Admin review is performed by a service-role API after trusted `app_metadata` admin authentication.
- Admin access to every event through the Organizer selector does not synthesize publication requests; `/api/organizer/claims` still returns only the signed-in user's request rows, and the dedicated admin review route remains authoritative.
- Direct admin e-mail assignment creates or reactivates an organizer membership only. It does not create a publication request or modify event/format live state.
- `review_race_event_publication_request` is invoker-security and executable only by `service_role`; approval rechecks the requested format and its own edition, grants durable approval to that Racebook only, publishes it, and closes the request atomically. Legacy rows without `race_id` retain the former current-edition behavior.
- `set_race_event_racebook_visibility` is also service-role-only. The admin event switch can publish complete current-edition Racebooks (granting approval and closing a pending request) or hide every Racebook under the event.

## Business Invariants

- Organizer event/race routes never accept direct catalog `is_live` changes. The race route accepts `racebookIsLive` only after the format has an admin approval timestamp.
- A directly delegated organizer receives the same membership-gated ability to maintain drafts and request publication, but assignment itself is not publication approval.
- A request requires event name/location, a valid `race_event_editions` range for the requested format, and that format's non-empty name, positive distance, and non-negative D+.
- A newly created empty edition is therefore editable but not publishable until the organizer adds at least one complete format.
- Organizer GPX replacement persists parsed distance and elevation on `races` and immediately mirrors those exact values into the active form, so readiness shown before a publication request matches the stored format row.
- Organizer Ravitos saves persist start/finish times through the race details route before saving `race_aid_stations`, so navigating away cannot leave the client schedule ahead of the stored draft.
- Normal scope navigation may save silently in the background, but requesting publication still waits for foreground persistence before the server readiness check.
- That foreground wait applies only when the request switch belongs to the currently edited format. Dirty or incomplete work on another format remains independent and must not block the request.
- Rejection leaves the already-hidden Racebook rows unchanged.
- Approval publishes only the requested Racebook. Other editions, complete formats, and incomplete formats remain unchanged.
- Once approved, an organizer may freely publish or hide each approved Racebook. This does not create a new request and does not alter course catalog visibility.
- Publication does not send runner notifications automatically.
- Sending or deleting a manual organizer announcement does not create, approve, reject, or reopen a Racebook publication request.
- Format-specific manual notifications are available only for already-live formats in the selected edition. Draft formats must pass the publication workflow before they can be selected as runner notification context.
- Removing the organizer-side runner preview and format quick actions does not alter readiness: publication still validates persisted event, edition, and format rows.
- An inherited format location remains empty on `races`; publication continues to require the event location, while an explicitly different format location is additive runner-facing data.
- The Organizer's single format-name control persists the same non-empty value to `races.name` and `races.series_name`; publication readiness continues to validate the canonical `name` field.

## Gotchas

- This is a publication review, not an ownership claim. Legacy claims may still protect access to pre-existing catalog events.
- Keep the assignment form and publication review actions independent even though they share the admin Organizer tab.
- Recheck readiness during admin approval because organizers can edit source data while a request is pending.
- Never infer the requested format from `race_event_editions.is_current`; the request's `race_id` is authoritative and may legitimately belong to a historical or non-current selected edition.
- Keep publication readiness sourced from persisted race values; client-side GPX form synchronization is only immediate feedback and does not bypass server-side revalidation.
- New public-schema tables require explicit grants as well as RLS.
- Do not use `races.is_live` as the Racebook publication source of truth. Use `racebook_is_live`; approval provenance is `racebook_publication_approved_at` / `racebook_publication_approved_by`.
- Roadbook preview uploads use temporary private Storage and may be 25 MB each; they do not establish publication readiness or approval.
- Admin-only LLM reconciliation is a pre-import proposal and does not establish publication readiness or approval.

## Related Docs

- [Organizer Race Management](../../03-business-rules/organizer-race-management.md)
- [race_event_organizers](race-event-organizers.md)
- [race_event_editions](race-event-editions.md)
- [RLS Policies](../rls-policies.md)
