---
title: race_event_publication_requests Table
scope: database
last_verified: 2026-08-26
ai_priority: high
related_files:
  - supabase/migrations/20260729110000_add_race_event_publication_requests.sql
  - supabase/migrations/20260820135823_add_racebook_publication_control.sql
  - supabase/migrations/20260820164141_target_racebook_publication_requests.sql
  - supabase/migrations/20260826090000_allow_event_level_publication_requests.sql
  - apps/web/lib/organizer-publication.ts
  - apps/web/app/api/organizer/publication-requests/route.ts
  - apps/web/app/api/organizer/editions/[id]/route.ts
  - apps/web/app/api/organizer/publication-requests/route.test.ts
  - apps/web/app/api/organizer/publication-requests/readiness.test.ts
  - apps/web/app/api/admin/event-publication-requests/route.ts
  - apps/web/app/api/admin/event-publication-requests/route.test.ts
  - apps/web/app/api/organizer/claims/route.ts
  - apps/web/app/organizer/_components/OrganizerDashboard.tsx
  - apps/web/app/organizer/_components/dashboard/types.ts
  - apps/web/app/organizer/_components/dashboard/website-import-review-details.tsx
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

This table is the sole first-publication review gate for organizer Racebooks. Courses remain visible in the catalog. An organizer submits a single event-level request (`race_id` null) that covers the whole current edition; admin approval publishes every complete format of that edition together, in one action. The per-format `race_id` targeting added in `20260820164141_target_racebook_publication_requests.sql` remains supported by the review function for legacy/back-compat rows, but the organizer dashboard no longer creates them.

## Columns

| Column | Type | Purpose |
| --- | --- | --- |
| `id` | `uuid` | Request identifier. |
| `created_at`, `updated_at` | `timestamptz` | Audit timestamps. |
| `user_id` | `uuid` | Organizer who requested publication. |
| `event_id` | `uuid` | Event to publish. |
| `race_id` | nullable `uuid` | Always null for current requests (event/current-edition-level). A non-null value is only ever produced by the retired per-format flow and is still honored by the review function for any leftover rows. |
| `status` | `text` | `pending`, `approved`, or `rejected`. |
| `reviewed_by`, `reviewed_at`, `reviewer_notes` | nullable audit fields | Admin review metadata. |

## Authorization

- An authenticated user may insert and read their own request only when they have an active `race_event_organizers` membership for the event.
- Only one pending request may exist per event (unique index on `event_id` where `race_id is null`); the retired per-format unique index on `race_id` still applies to any legacy row.
- Admin review is performed by a service-role API after trusted `app_metadata` admin authentication.
- Admin access to every event through the Organizer selector does not synthesize publication requests; `/api/organizer/claims` still returns only the signed-in user's request rows, and the dedicated admin review route remains authoritative.
- Direct admin e-mail assignment creates or reactivates an organizer membership only. It does not create a publication request or modify event/format live state.
- `review_race_event_publication_request` is invoker-security and executable only by `service_role`. When `race_id` is null, approval publishes every complete format of the event's current edition at once (`is_live`, `racebook_is_live`, approval provenance) and closes the request atomically. A non-null `race_id` (legacy rows only) still publishes just that one format.
- `set_race_event_racebook_visibility` is also service-role-only. The admin event switch can publish complete current-edition Racebooks (granting approval and closing a pending request) or hide every Racebook under the event.

## Business Invariants

- Organizer event/race routes never accept direct catalog `is_live` changes. The race route accepts `racebookIsLive` only after the format has an admin approval timestamp.
- A directly delegated organizer receives the same membership-gated ability to maintain drafts and request publication, but assignment itself is not publication approval.
- An event-level request requires event name/location plus a valid `race_event_editions` range for the current edition, and at least one of that edition's formats with a non-empty name, positive distance, and non-negative D+ (`validateOrganizerEventPublication` without a `raceId`).
- The dashboard's single `Demander la publication` action stays visible for the whole selected edition (not gated by which format tab is open) and submits at most one request at a time for the event.
- The dashboard disables the request button while the edition is hidden, while a request is already pending, or once every format of the edition is already approved. Database visibility triggers still force `racebook_is_live = false` if an older/pending approval completes after the edition was hidden.
- A newly created empty edition is therefore editable but not publishable until the organizer adds at least one complete format.
- Organizer GPX replacement persists parsed distance and elevation on `races` and immediately mirrors those exact values into the active form, so readiness shown before a publication request matches the stored format row.
- Organizer Ravitos saves persist start/finish times through the race details route before saving `race_aid_stations`, so navigating away cannot leave the client schedule ahead of the stored draft.
- Requesting publication always saves any dirty foreground scope before the server readiness check runs.
- Rejection leaves the already-hidden Racebook rows unchanged.
- Approval publishes every complete format of the requested current edition together; incomplete formats and other editions remain unchanged.
- Once approved, an organizer may freely publish or hide each approved format's Racebook individually through its own on/off switch. This does not create a new request and does not alter course catalog visibility.
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
- For current (null `race_id`) requests, the review function always targets the event's current edition (`race_event_editions.is_current`), not whichever edition happens to be selected in the organizer UI at request time.
- Edition deletion cascades any targeted legacy request tied to its deleted format. Edition hiding preserves durable approval/history but clears the live Racebook flag, which must be republished explicitly after the edition is shown again.
- Keep publication readiness sourced from persisted race values; client-side GPX form synchronization is only immediate feedback and does not bypass server-side revalidation.
- New public-schema tables require explicit grants as well as RLS.
- Do not use `races.is_live` as the Racebook publication source of truth. Use `racebook_is_live`; approval provenance is `racebook_publication_approved_at` / `racebook_publication_approved_by`.
- Roadbook preview uploads use temporary private Storage and may be 25 MB each; they do not establish publication readiness or approval.
- Admin-only claim reconciliation and the signed per-field import snapshot are pre-publication controls. Confirming formats may create hidden incomplete drafts, and applying selected claims may complete source fields, but neither action establishes Racebook readiness or approval; the publication route revalidates persisted data independently.
- Source-role classification for additional URLs and PDFs is likewise review evidence only. It cannot publish a course, approve a Racebook, or create a publication request.

## Related Docs

- [Organizer Race Management](../../03-business-rules/organizer-race-management.md)
- [race_event_organizers](race-event-organizers.md)
- [race_event_editions](race-event-editions.md)
- [RLS Policies](../rls-policies.md)
