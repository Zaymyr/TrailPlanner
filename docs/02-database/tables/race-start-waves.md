---
title: race_start_waves Table
scope: database
last_verified: 2026-09-10
ai_priority: high
related_files:
  - supabase/migrations/20260907160043_add_structured_racebook_content.sql
  - supabase/migrations/20260907170842_fix_structured_racebook_rls_dependencies.sql
  - supabase/migrations/20260908160018_preserve_global_start_time_without_waves.sql
  - apps/web/app/api/organizer/races/[id]/start-waves/route.ts
  - apps/web/lib/organizer-structured-content.ts
  - apps/web/app/organizer/_components/dashboard/structured-content-editors.tsx
  - apps/web/app/organizer/_components/dashboard/structured-content-editors.test.ts
  - apps/mobile/lib/racebook.ts
  - apps/mobile/app/(app)/race/[id]/racebook.tsx
related_tables:
  - race_start_waves
  - races
---

# `race_start_waves`

## Purpose and invariants

SAS require Complete or Signature plus an active `start_waves` format module. Disabling masks published rows and blocks organizer writes without deleting them.

Stores ordered start waves (SAS) for a format. Each row has a name, native departure time, ordering and one criterion: all runners, bib range, estimated finish-time range, pace range or custom rule. Database checks require only the bounds relevant to that criterion and reserve free text for `custom`.

Existing `organizer_details.schedule.startTime` values are backfilled as `Départ commun`. Atomic replacement preserves submitted ids and synchronizes the earliest SAS time back to `schedule.startTime` for legacy consumers. While at least one SAS exists, its earliest time is authoritative and the Organizer disables manual editing of the common start time. Removing the last SAS preserves the last synchronized `schedule.startTime`, which becomes editable again. Deleting or duplicating a format cascades or copies rows respectively.

Public/preview read and mutation rules are identical to other RaceBook content: published RaceBook or authorized organizer for reads, and service-role API plus `racebook_content.manage` for writes.

The collection is additive on mobile: a temporary Data API/table-unavailable error is treated as no SAS so legacy RaceBooks remain readable during staggered deployment. Its public policy resolves publication solely through `races`; it must not join the service-role-only `race_event_editions` table. Published primary surfaces may style SAS cards and accent-tinted positive information rows may highlight the schedule, but neither changes time authority or ordering.

The Organizer editor serializes revisioned autosaves: a response for an older revision cannot replace newer local SAS edits and instead queues the latest revision. Masking a format from the private demo suppresses its whole RaceBook entry without deleting start waves.
