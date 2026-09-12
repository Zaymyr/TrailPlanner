---
title: race_event_publication_requests Table
scope: database
last_verified: 2026-09-12
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

This table is retained publication-review history. New organizer publication uses a paid/admin edition entitlement and does not create a request. Courses remain visible in the catalog. Existing event-level and per-format rows remain reviewable for compatibility; approving a legacy row also grants Pro to the relevant edition.

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
- New paid RaceBook publication bypasses this queue after the webhook activates the edition entitlement; no additional admin approval is required.
- `review_race_event_publication_request` is invoker-security and executable only by `service_role`. When `race_id` is null, approval publishes every complete format of the event's current edition at once (`is_live`, `racebook_is_live`, approval provenance) and closes the request atomically. A non-null `race_id` (legacy rows only) still publishes just that one format.
- `set_race_event_racebook_visibility` is also service-role-only. The admin event switch can publish complete current-edition Racebooks (granting approval and closing a pending request) or hide every Racebook under the event.

## Business Invariants

- Organizer event/race routes never accept direct catalog `is_live` changes. Publishing with `racebookIsLive = true` uses the membership- and entitlement-checked RPC. Hiding with `racebookIsLive = false` is a targeted service update performed only after the shared route has authorized event membership or trusted admin access; it clears one format and cannot publish content.
- A directly delegated organizer receives the same event membership and therefore the edition capability purchased or granted for that event.
- The paid checkout validates event name/location, the selected edition range, and at least one complete format before creating a Stripe session.
- From Visibilité, the current dashboard publication action opens the edition offer dialog and never creates a publication-request row. A format-route `403` may reopen that dialog only while the displayed tier is also Visibilité. With Essential, Complete, or Signature already active, single-format and bulk publication never upsell; operational failures stay visible and higher-tier sections remain filtered from runner output. A trusted admin may grant RaceBook from the offer dialog without payment through the current edition-grant RPC; the grant is edition-scoped and leaves this legacy table unchanged.
- Detailed format visibility starts collapsed while the primary publication action remains visible. Expanding it does nothing by itself; explicitly choosing Masqué, Privé, or Public updates the authorized format state without creating a publication-request row.
- The authorized format navigation mirrors that state without writing it: masked formats remain editable but appear grey with `Course masquée pour le public`, while private/public formats show compact status text. These labels neither publish a RaceBook nor create a publication-request row.
- The dashboard guide only explains those visibility states. It temporarily opens the real controls without selecting one; completing, skipping, or replaying it does not create a publication request.
- Staged section switches affect publication and completion only after their single module-settings PATCH succeeds; their edition-common/per-format grouping never inserts a row in this legacy publication queue.
- Legacy pending requests remain reviewable in admin. Their approval grants a permanent Pro admin entitlement to the corresponding edition for backward compatibility.
- A newly created empty edition is therefore editable but not publishable until the organizer adds at least one complete format.
- Organizer GPX replacement persists parsed distance and elevation on `races` and immediately mirrors those exact values into the active form, so readiness shown before a publication request matches the stored format row.
- Organizer Ravitos saves persist start/finish times through the race details route before saving `race_aid_stations`, so navigating away cannot leave the client schedule ahead of the stored draft.
- Starting checkout always saves any dirty foreground scope before the server readiness check runs.
- The checkout popup captures and displays the selected event and canonical edition when it opens. It never substitutes a transient year string for the billed `edition_id`.
- Rejecting a legacy request leaves hidden Racebook rows unchanged.
- Every authorized organizer may move a format between Masqué and Privé without an offer. Masqué clears both preview and runner visibility; Privé preserves organizer preview while clearing runner visibility. With a paid or complimentary edition offer, Public uses the existing membership-, readiness-, and entitlement-checked format publication path. The primary edition CTA publishes all private-selected complete formats atomically without demanding an upgrade merely because higher-tier drafts exist. None of these operations creates a legacy request.
- Publication does not send runner notifications automatically.
- Sending or deleting a manual organizer announcement does not create, approve, reject, or reopen a Racebook publication request.
- Format-specific manual notifications are available only for already-live formats in the selected edition. Draft formats must pass the publication workflow before they can be selected as runner notification context.
- Removing the organizer-side runner preview and format quick actions does not alter readiness: publication still validates persisted event, edition, and format rows.
- A normally created or saved format persists its effective inherited event location on `races`; an explicitly different format location replaces that snapshot. Both paths satisfy the same server-side publication check.
- The dashboard checks name, date, effective location, positive distance, and official source before opening pricing. The checkout route remains authoritative and revalidates persisted rows before creating a payment attempt.
- The Organizer's single format-name control persists the same non-empty value to `races.name` and `races.series_name`; publication readiness continues to validate the canonical `name` field.
- Publishing an edition's visual identity is a separate Pro-only draft-to-published operation. It does not publish a format, change `racebook_is_live`, or insert/update this legacy review table.

## Gotchas

- Current admin pack changes, Visibilité downgrades, and direct-virement recording do not create or reopen legacy publication-request rows.
- The admin rights search, offer filter, and ten-event pagination are client-side presentation controls; they do not change or narrow the dedicated pending-request review queue.
- Canonical direct-virement pricing, the validated 20%-or-zero VAT choice, and same-day payment-date normalization occur in the protected payment route without touching this legacy request table.

- The current admin publication manager writes the edition entitlement origin, not a legacy publication-request row. Admin and Offert are distinct, while Stripe/virement require matching paid history.

- Abortable dashboard reloads prevent stale UI state but do not cancel or weaken a publication request already accepted by the server; entitlement and readiness remain server-authoritative.

- This is a publication review, not an ownership claim. Legacy claims may still protect access to pre-existing catalog events.
- Keep assignment and publication review independent in the admin Organizer area: publication controls belong to `Publier le RaceBook`, while membership assignment and active access belong to `Accès organisateurs`.
- Recheck readiness during admin approval because organizers can edit source data while a request is pending.
- For current (null `race_id`) requests, the review function always targets the event's current edition (`race_event_editions.is_current`), not whichever edition happens to be selected in the organizer UI at request time.
- Edition deletion cascades any targeted legacy request tied to its deleted format. Edition hiding preserves durable approval/history but clears the live Racebook flag, which must be republished explicitly after the edition is shown again.
- Keep publication readiness sourced from persisted race values; client-side GPX form synchronization is only immediate feedback and does not bypass server-side revalidation.
- New public-schema tables require explicit grants as well as RLS.
- Do not use `races.is_live` as the Racebook publication source of truth. Use `racebook_is_live`; approval provenance is `racebook_publication_approved_at` / `racebook_publication_approved_by`.
- Roadbook preview uploads use temporary private Storage and may be 25 MB each; they do not establish publication readiness or approval.
- Admin-only claim reconciliation and the signed per-field import snapshot are pre-publication controls. Confirming formats may create hidden incomplete drafts, and applying selected claims may complete source fields, but neither action establishes Racebook readiness or approval; the publication route revalidates persisted data independently.
- Source-role classification for additional URLs and PDFs is likewise review evidence only. It cannot publish a course, approve a Racebook, or create a publication request.
- Do not treat `published_at` on edition branding as RaceBook content approval; it records only which visual snapshot runner payloads may use.
- Seeing a local organizer-phone draft is not publication readiness or approval evidence. The publication route continues to revalidate persisted data and effective modules.

## Related Docs

- [Organizer Race Management](../../03-business-rules/organizer-race-management.md)
- [race_event_organizers](race-event-organizers.md)
- [race_event_editions](race-event-editions.md)
- [RLS Policies](../rls-policies.md)
