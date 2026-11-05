---
title: video_narrations Table
scope: database
last_verified: 2026-11-05
ai_priority: low
related_files:
  - supabase/migrations/20261105160000_add_video_narrations.sql
  - supabase/tests/video_narrations_checks.sql
  - apps/web/lib/video-narrations.ts
  - apps/web/app/api/admin/video-generator/narrations/[raceId]/route.ts
  - apps/web/app/api/admin/video-generator/race-stats/route.ts
related_tables:
  - video_narrations
  - video_render_jobs
  - races
---

# `video_narrations`

## Purpose

The saved narration of the admin 3D reel, one row per race, so a race's script is written and voiced once and reloaded the next time it is opened in the video generator. The voice clips (base64 MP3, about 2 MB per reel) are not in the table: they live in the private Storage bucket `video-narrations` as `<race_id>.json`.

## Columns

| Column | Type | Constraints/default | Purpose |
| --- | --- | --- | --- |
| `race_id` | `uuid` | primary key, references `races(id)` on delete cascade | Narrated race. |
| `settings` | `jsonb` | not null, `{}` | Composition settings when saved. They decide the story cut, hence the beat ids the texts belong to; the editor parses them with its own schema so older saves stay readable. |
| `narration_overrides` | `jsonb` | not null, `{}` | Narration text by beat id (AI draft or hand edit). |
| `voice` | `jsonb` | not null, `{}` | `voiceId` (ElevenLabs, nullable for the default voice), `model`, `expressiveness`. |
| `clip_count` | `integer` | not null, ≥ 0, default 0 | Number of clips in the Storage object; 0 when none was saved. |
| `updated_by` | `uuid` | references `auth.users(id)` on delete set null, indexed | Admin who saved last. |
| `updated_at` | `timestamptz` | not null, now | Last save. |

## Storage

Bucket `video-narrations`: private, 20 MB per object, `application/json` only, no policy. A text-only save leaves the object as is; a save with clips replaces it (`x-upsert`). A missing or unreadable object only costs a voice regeneration: the text still loads.

## Access

RLS is on with no policy; `anon` and `authenticated` have no privilege. Only the service role (admin API routes `GET`/`PUT /api/admin/video-generator/narrations/[raceId]` and `GET /api/admin/video-generator/race-stats`) reads and writes the table and the bucket.

## Business rules

- A clip is used only while its text equals the beat narration, so a stale clip after an edit is ignored, never played over the wrong text.
- The race picker shows, per format, whether a narration (and its voice) is saved, from `race-stats`, next to the number of finished background videos from `video_render_jobs`.
