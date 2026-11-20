---
title: video_voices Table
scope: database
last_verified: 2026-11-20
ai_priority: low
related_files:
  - supabase/migrations/20261120090000_add_video_voices.sql
  - supabase/tests/video_voices_checks.sql
  - apps/web/lib/video-voices.ts
  - apps/web/app/api/admin/video-generator/voices/route.ts
  - apps/web/app/api/admin/video-generator/voices/[id]/route.ts
  - apps/web/app/admin/video-generator/voice-pool.ts
  - apps/web/app/admin/video-generator/useVoicePool.ts
  - apps/web/app/admin/video-generator/VoiceSection.tsx
related_tables:
  - video_voices
  - video_narrations
---

# `video_voices`

## Purpose

The shared pool of ElevenLabs voices of the admin reel generator. The admin keeps 4 or 5 voices here and each new reel draws one active voice at random, so consecutive reels do not all sound the same. Before this table the voices only lived in the admin's browser (`localStorage`, see [Mapbox 3D](../../05-integrations/mapbox-3d.md)); the pool is shared between admins and devices.

## Columns

| Column | Type | Constraints/default | Purpose |
| --- | --- | --- | --- |
| `id` | `uuid` | primary key, `gen_random_uuid()` | Row id used by the admin routes (`PATCH`/`DELETE`). |
| `elevenlabs_voice_id` | `text` | not null, unique, matches `^[A-Za-z0-9]{8,64}$` (the rule of `isPlausibleVoiceId`) | ElevenLabs voice id sent to the voice route. The same voice cannot be added twice. |
| `name` | `text` | not null, 1-40 characters | Name shown in the editor (« Voix : <nom> ») and saved with the narration. |
| `active` | `boolean` | not null, default `true` | Only active voices are drawn at random; a deactivated voice stays listed and can still be chosen by hand. |
| `created_by` | `uuid` | references `auth.users(id)` on delete set null, indexed | Admin who added it. |
| `created_at`, `updated_at` | `timestamptz` | not null, now (UTC) | `updated_at` is refreshed by the trigger `set_video_voices_updated_at`. |

## Access

RLS is on with no policy; every privilege is revoked from `public`, `anon` and `authenticated` and granted to `service_role`, like `video_render_jobs`. Only the admin routes read and write it, each gated by `authorizeVideoAdmin`:

- `GET /api/admin/video-generator/voices` lists the voices.
- `POST` adds `{ voiceId, name? }`; a duplicate id answers 409 « Cette voix est déjà dans le pool. ». When `ELEVENLABS_API_KEY` is set, the route looks the voice up (`GET https://api.elevenlabs.io/v1/voices/{voice_id}`, header `xi-api-key`) to suggest its name when none is given; a failed lookup only returns a `warning`, never blocks, and the key is never logged or returned.
- `PATCH /voices/[id]` changes `name` and/or `active` (404 when unknown).
- `DELETE /voices/[id]` removes the voice (404 when unknown).

`supabase/tests/video_voices_checks.sql` checks RLS, the missing client grants, the default, the `updated_at` trigger, the unique id and the id and name checks.

## Business rules

- « Au hasard » (the editor's default) draws one active voice per new reel (`pickPoolVoice`), leaving out the voice of the race's previous narration when at least two voices are active. An empty pool falls back to the free id field, then to `ELEVENLABS_VOICE_ID`, then to the premade default.
- The picked voice is saved in `video_narrations.voice` (`voiceId` and `voiceName`, no schema change: the column is `jsonb`). Generating the voice of an existing narration keeps that voice unless the admin clicks « Changer de voix ».
- Deleting a voice never breaks a saved narration: it keeps its `voiceId` and name and its clips are already stored.
- The voice route still validates the id with `ELEVENLABS_VOICE_ID_PATTERN` (10-40 characters), narrower than the table check; real ElevenLabs ids are 20 characters.
