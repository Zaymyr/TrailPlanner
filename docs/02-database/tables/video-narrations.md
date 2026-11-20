---
title: video_narrations Table
scope: database
last_verified: 2026-11-20
# Race stats publication mark (2026-11-20): race-stats adds each race's Instagram publication mark for the picker; video_narrations itself is unchanged.
ai_priority: low
related_files:
  - supabase/migrations/20261105160000_add_video_narrations.sql
  - supabase/migrations/20261119120000_add_video_narrations_mode.sql
  - supabase/migrations/20261119160000_add_reel_content.sql
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

The saved narration of the admin 3D reel, one row per race and story mode ("Parcours complet" `full`, "Temps forts" `highlights`), so a race's script is written and voiced once per mode and reloaded the next time it is opened in the video generator. The voice clips (base64 MP3, about 2 MB per reel) are not in the table: they live in the private Storage bucket `video-narrations` as `<race_id>.json` (full) and `<race_id>.highlights.json` (highlights).

## Columns

| Column | Type | Constraints/default | Purpose |
| --- | --- | --- | --- |
| `race_id` | `uuid` | primary key with `mode`, references `races(id)` on delete cascade | Narrated race. |
| `mode` | `text` | primary key with `race_id`, not null, default `'full'`, check in (`full`, `highlights`) | Story mode of the narration; rows saved before 2026-11-19 are `full`. |
| `settings` | `jsonb` | not null, `{}` | Composition settings when saved. They decide the story cut, hence the beat ids the texts belong to; the editor parses them with its own schema so older saves stay readable. |
| `narration_overrides` | `jsonb` | not null, `{}` | Narration text by beat id (AI draft or hand edit). |
| `voice` | `jsonb` | not null, `{}` | `voiceId` (ElevenLabs, nullable for the default voice), `model`, `expressiveness`. |
| `content` | `jsonb` | nullable, JSON object when set (`video_narrations_content_object`) | Highlights reel text written in one call (hook, script segments, call to action, caption, hashtags, cover text), validated by `reelContentSchema` (`apps/web/lib/reel-content.ts`) and reloaded with the race and mode. Only saved for `highlights`; null for `full` rows, rows saved before 2026-11-19 and when the save omitted it (an omitted `content` keeps the stored one, `null` clears it). |
| `clip_count` | `integer` | not null, ≥ 0, default 0 | Number of clips in the Storage object; 0 when none was saved. |
| `updated_by` | `uuid` | references `auth.users(id)` on delete set null, indexed | Admin who saved last. |
| `updated_at` | `timestamptz` | not null, now | Last save. |

## Storage

Bucket `video-narrations`: private, 20 MB per object, `application/json` only, no policy. A text-only save leaves the object as is; a save with clips replaces it (`x-upsert`). A missing or unreadable object only costs a voice regeneration: the text still loads. Each clip carries `characterEndMs` and, since the word-timed subtitles, an optional `characterStartMs` (per-character times of `text`); clips saved before have none, still parse, and their subtitle pauses follow punctuation only.

## Access

RLS is on with no policy; `anon` and `authenticated` have no privilege. Only the service role (admin API routes `GET`/`PUT /api/admin/video-generator/narrations/[raceId]?mode=full|highlights`, `full` when absent and 400 when unknown, and `GET /api/admin/video-generator/race-stats`) reads and writes the table and the bucket. Saves upsert on `(race_id, mode)`.

## Business rules

- A clip is used only while its text equals the beat narration, so a stale clip after an edit is ignored, never played over the wrong text.
- The race picker shows, per format, whether a narration (and its voice) is saved, from `race-stats`, next to the number of finished background videos from `video_render_jobs`.
- Each mode saves only its own texts: highlight beats use `hl-…` ids (`hl-intro`, `hl-outro` included), full beats never do. The editor loads a mode's narration once per race, when the race opens or when the mode is first chosen, and merges its texts and clips with the other mode's ([ADR](../../08-decisions/2026-11-19-reel-highlights-and-figures.md)).
- `race-stats` reports a race as narrated (and voiced) when any of its modes is. It also returns the race's Instagram publication mark (`publication`, from `social_posts` through `readPublicationMarks`; null when none or when that read fails).

## Gotchas

- The `(race_id)` to `(race_id, mode)` key change makes an upsert with `on_conflict=race_id` fail (no matching unique constraint). Between the migration and the web deploy of the same release, a save from the previous web version fails with an error message; reads keep working.
