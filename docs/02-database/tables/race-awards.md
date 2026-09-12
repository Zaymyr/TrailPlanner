---
title: race_awards Table
scope: database
last_verified: 2026-09-12
ai_priority: high
related_files:
  - supabase/migrations/20260907160043_add_structured_racebook_content.sql
  - supabase/migrations/20260907170842_fix_structured_racebook_rls_dependencies.sql
  - apps/web/app/api/organizer/races/[id]/awards/route.ts
  - apps/web/lib/organizer-structured-content.ts
  - apps/web/app/organizer/_components/dashboard/structured-content-editors.tsx
  - apps/web/app/organizer/_components/dashboard/structured-content-editors.test.ts
  - apps/mobile/lib/racebook.ts
  - apps/mobile/app/(app)/race/[id]/racebook.tsx
related_tables:
  - race_awards
  - races
---

# `race_awards`

## Purpose and invariants

Awards require Complete or Signature plus an active `awards` format module. Disabling masks published rows and blocks organizer writes without deleting them.

Stores the podium programme for a format, not finisher results. A row records a preset (`scratch`, `u18`, `u20`, `u23`, `senior`, `master`) or custom category, its persisted display label, audience, inclusive rewarded-place range, required podium time, optional location and reward/note.

Rows are ordered, replaced atomically with stable submitted ids, cascade with their format and are copied during Pro edition duplication. Public and organizer-preview reads use RLS; mutations only pass through the Organizer API after `racebook_content.manage` authorization.

The shared web editor file also reports SAS count and earliest time to the surrounding schedule card. That callback is start-wave-only and does not change award persistence or completion.

The collection is additive on mobile: a temporary Data API/table-unavailable error is treated as no awards and does not invalidate the rest of the RaceBook. Its public policy resolves publication through `races`, without requiring client access to `race_event_editions`. Published edition primary surfaces and borders style podium cards only; they never change award ordering or meaning, while semantic states remain independent.

The two-line clamp applied to bib-pickup address text is isolated from podium rendering and does not change award data or visibility.

The format access override that hides saved runner information is likewise independent from award rows and their visibility.

The Organizer editor serializes revisioned autosaves: a response for an older revision cannot replace newer local award edits and instead queues the latest revision. Masking a format from the private demo suppresses its whole RaceBook entry without deleting awards.

Published rows travel in the consolidated RaceBook CDN snapshot. A successful atomic awards replacement invalidates the parent race tag after persistence.
