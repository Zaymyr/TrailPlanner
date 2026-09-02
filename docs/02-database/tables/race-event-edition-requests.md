---
title: race_event_edition_requests Table
scope: database
last_verified: 2026-09-02
ai_priority: medium
related_files:
  - supabase/migrations/20260721110000_add_race_event_edition_requests.sql
  - supabase/migrations/20260729110000_add_race_event_publication_requests.sql
  - apps/web/app/api/organizer/claims/route.ts
  - apps/web/app/api/organizer/edition-requests/route.ts
  - apps/web/app/api/organizer/editions/[id]/route.ts
  - apps/web/app/api/organizer/edition-requests/route.test.ts
  - apps/web/app/api/admin/organizer-claims/route.ts
  - apps/web/app/organizer/_components/OrganizerDashboard.tsx
  - apps/web/app/organizer/_components/dashboard/website-import-review-details.tsx
  - apps/web/app/organizer/_components/dashboard/shell.tsx
  - apps/web/app/admin/_components/AdminOrganizerClaimsTab.tsx
related_tables:
  - race_event_edition_requests
  - race_event_editions
  - race_events
  - races
---

# `race_event_edition_requests`

## Purpose

This is a retained legacy audit table. It previously gated yearly edition creation behind admin review. Since `20260729110000_add_race_event_publication_requests.sql`, new organizer editions are cloned directly as drafts and validation occurs only when publication is requested.

## Retired Workflow

- Existing pending rows are closed as rejected by the transition migration with an explanatory reviewer note.
- `authenticated` insert/update grants and the organizer insert policy are removed.
- `POST /api/organizer/edition-requests` keeps its historical URL for compatibility but now creates a canonical `race_event_editions` range. Its `duplicatePreviousEdition` input defaults to `true` for backward compatibility; when false, the route creates the edition without cloning source-year formats. It does not insert this table.
- Newly created canonical editions use the database's visible-by-default state. Later visibility changes or confirmed year-typed deletion use `/api/organizer/editions/[id]`, not this retired request table.
- Legacy rows remain readable for audit and may still be returned by compatibility APIs.
- `/api/organizer/claims` continues to return only the current user's legacy edition-request rows even when its event selector is expanded to the full catalog for an admin; selector access does not revive or broaden this retired workflow.
- Ordinary format saves, including checked format-specific bib-pickup, equipment, or access overrides, Ravitos schedule/station saves, image uploads, and GPX replacements preserve the active `races.race_date` year; they do not read or write this retired table. Edition selection changes immediately while the previous scope saves silently in the background. Ravitos saves PATCH race-level schedule details before PUTting station rows and do not reload the previous edition over the new selection.
- Per-format publication switches also stay independent from this retired workflow and from other dirty format scopes: only the switched format may require a foreground save, and the selected edition's paid or admin-granted entitlement authorizes the switch without creating an edition-request row.
- Removing the standalone `Dupliquer ce format` action does not affect edition duplication, but the compatibility route now requires the source edition's Pro capability when `duplicatePreviousEdition` is enabled. Creating an empty edition remains free.
- The format location override is independent from edition selection and does not read or write this retired request table.
- Consolidating the Organizer format name input keeps `name` and `series_name` synchronized but does not change edition creation or the stable `edition_group_id` copied across years.
- The runner-notification format selector reads live formats from the currently selected canonical edition; it does not create, reactivate, or consult legacy edition requests.
- Deleting a previously sent organizer announcement is likewise event-membership scoped and does not read, restore, or mutate this retired table.
- Direct admin assignment, including a newly invited Auth account confirmed through the admin access dialog, creates or reactivates only `race_event_organizers`; it does not create, reactivate, or review a legacy edition request.

## Historical Columns

The table retains `id`, timestamps, `user_id`, `event_id`, `source_year`, `requested_start_date`, review status, reviewer identity, review timestamp, and reviewer notes. Foreign keys continue to preserve historical user/event relationships according to the original migration.

## Gotchas

- Do not restore organizer inserts or add new review UI for this table.
- Do not interpret old `approved` rows as current publication approval; publication uses `race_event_publication_requests`.
- When optional edition duplication is enabled, cloned `races` rows must attach through `edition_id`, preserve their cross-year `edition_group_id`, and start with hidden/unapproved Racebook publication state even though the course row is catalog-visible. An empty edition legitimately has no attached format until the organizer adds one.
- Dated service-side format inserts that arrive without `edition_id` are attached by the canonical-edition trigger; this safety net does not revive the retired edition-request workflow.
- Hiding or deleting an already-created edition is not a review request. Both are immediate membership-checked organizer actions, while deleting the event's only edition is rejected.
- Do not pass a race id where the dashboard refresh expects an edition year; media and GPX refreshes must retain the year derived from `races.race_date` without reviving edition-review state.
- Do not couple direct organizer delegation to this retired workflow. Membership assignment and yearly edition creation remain separate operations.
- Roadbook preview uploads may be 25 MB each because they use temporary private Storage and remain review-only; they do not create or reactivate an edition request.
- The admin-only two-pass import binds its session directly to a canonical edition id. Format confirmation and signed field selections can affect only explicitly confirmed current rows under that edition; neither operation revives this retired request workflow.
- Classifying additional official URLs or text PDFs may surface a date claim, but it never retargets the import session or creates a legacy edition request.

## Related Docs

- [race_event_publication_requests](race-event-publication-requests.md)
- [race_event_editions](race-event-editions.md)
- [Organizer Race Management](../../03-business-rules/organizer-race-management.md)
