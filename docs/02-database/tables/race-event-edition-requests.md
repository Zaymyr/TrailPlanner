---
title: race_event_edition_requests Table
scope: database
last_verified: 2026-07-29
ai_priority: medium
related_files:
  - supabase/migrations/20260721110000_add_race_event_edition_requests.sql
  - supabase/migrations/20260729110000_add_race_event_publication_requests.sql
  - apps/web/app/api/organizer/claims/route.ts
  - apps/web/app/api/organizer/edition-requests/route.ts
  - apps/web/app/api/organizer/edition-requests/route.test.ts
  - apps/web/app/api/admin/organizer-claims/route.ts
  - apps/web/app/organizer/_components/OrganizerDashboard.tsx
  - apps/web/app/organizer/_components/dashboard/shell.tsx
  - apps/web/app/admin/_components/AdminOrganizerClaimsTab.tsx
related_tables:
  - race_event_edition_requests
  - race_events
  - races
---

# `race_event_edition_requests`

## Purpose

This is a retained legacy audit table. It previously gated yearly edition creation behind admin review. Since `20260729110000_add_race_event_publication_requests.sql`, new organizer editions are cloned directly as drafts and validation occurs only when publication is requested.

## Retired Workflow

- Existing pending rows are closed as rejected by the transition migration with an explanatory reviewer note.
- `authenticated` insert/update grants and the organizer insert policy are removed.
- `POST /api/organizer/edition-requests` keeps its historical URL for compatibility but now clones source-year formats directly; it does not insert this table.
- Legacy rows remain readable for audit and may still be returned by compatibility APIs.

## Historical Columns

The table retains `id`, timestamps, `user_id`, `event_id`, `source_year`, `requested_start_date`, review status, reviewer identity, review timestamp, and reviewer notes. Foreign keys continue to preserve historical user/event relationships according to the original migration.

## Gotchas

- Do not restore organizer inserts or add new review UI for this table.
- Do not interpret old `approved` rows as current publication approval; publication uses `race_event_publication_requests`.
- Direct edition cloning must keep new `races` rows in draft and preserve their `edition_group_id` series relationship.

## Related Docs

- [race_event_publication_requests](race-event-publication-requests.md)
- [Organizer Race Management](../../03-business-rules/organizer-race-management.md)
