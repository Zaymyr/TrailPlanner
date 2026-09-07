---
title: race_start_waves Table
scope: database
last_verified: 2026-09-07
ai_priority: high
related_files:
  - supabase/migrations/20260907160043_add_structured_racebook_content.sql
  - apps/web/app/api/organizer/races/[id]/start-waves/route.ts
  - apps/web/lib/organizer-structured-content.ts
  - apps/web/app/organizer/_components/dashboard/structured-content-editors.tsx
  - apps/mobile/lib/racebook.ts
  - apps/mobile/app/(app)/race/[id]/racebook.tsx
related_tables:
  - race_start_waves
  - races
---

# `race_start_waves`

## Purpose and invariants

Stores ordered start waves (SAS) for a format. Each row has a name, native departure time, ordering and one criterion: all runners, bib range, estimated finish-time range, pace range or custom rule. Database checks require only the bounds relevant to that criterion and reserve free text for `custom`.

Existing `organizer_details.schedule.startTime` values are backfilled as `Départ commun`. Atomic replacement preserves submitted ids and synchronizes the earliest SAS time back to `schedule.startTime` for legacy consumers. Deleting or duplicating a format cascades or copies rows respectively.

Public/preview read and mutation rules are identical to other RaceBook content: published RaceBook or authorized organizer for reads, and service-role API plus `racebook_content.manage` for writes.
