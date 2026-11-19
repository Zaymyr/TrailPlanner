---
title: Reel figures and highlights mode
scope: decision
last_verified: 2026-11-19
ai_priority: medium
related_files:
  - apps/web/app/admin/video-generator/race-figures.ts
  - apps/web/app/admin/video-generator/highlights.ts
  - apps/web/app/admin/video-generator/video-composition.ts
  - apps/web/app/api/admin/video-generator/script/route.ts
  - apps/web/lib/video-narrations.ts
  - apps/web/app/api/admin/video-generator/narrations/[raceId]/route.ts
  - supabase/migrations/20261119120000_add_video_narrations_mode.sql
  - apps/web/app/admin/video-generator/route-story.ts
  - apps/web/app/admin/video-generator/VideoCompositionOverlay.tsx
  - apps/web/app/admin/video-generator/VideoGeneratorMapClient.tsx
  - apps/web/app/admin/video-generator/subtitle-groups.ts
  - apps/web/app/admin/video-generator/render-snapshot.ts
  - apps/web/app/api/admin/video-generator/voice/route.ts
  - apps/web/lib/spoken-numbers.ts
  - apps/web/app/admin/video-generator/reel-hook.ts
  - apps/web/app/admin/video-generator/route-animation.ts
  - supabase/migrations/20261119150000_add_race_events_short_name.sql
related_tables:
  - races
  - race_aid_stations
  - video_narrations
  - race_events
---

# Reel Figures And Highlights Mode

## Status

Accepted (2026-11-19).

## Context

Two needs met in the admin reel generator. First, the reel showed two different totals for the same race. The badge "N KM" rounded `races.distance_km`, the live counter "KM x / N" rounded the GPX length, and the story, the aid cards and the AI inputs mixed both sources with their own rounding (integer in one place, one decimal in another). Nothing reconciled the race record with the GPX, so a 66.63 km race measured 64.9 km on its GPX could read "67 KM" on the badge and "/ 65" on the counter.

Second, a full-course flyover of an ultra lasts up to 2-3 minutes; a short "temps forts" reel (30-45 s) suits Instagram better.

## Decision

1. **The race record is the announced truth.** `races.distance_km` and `races.elevation_gain_m` drive the badge, the intro, the counter total and the race figures sent to the script and caption writers.
2. **The GPX is rescaled to it.** Every GPX kilometre shown (counter, legs, caption ranges, profile ticks, aid cards, script `deKm`/`aKm`, stations flown over) is multiplied by race km ÷ GPX km, and every GPX D+ by race D+ ÷ GPX D+. A race figure is trusted within ±15 % of the GPX length (±35 % for D+, which depends far more on smoothing); otherwise, or when it is missing, the GPX figure is used everywhere (badge included) and the editor logs a warning. Grades and D− stay as measured on the GPX. Organizer station kilometres are in the announced scale and are converted once to place stations on the GPX.
3. **One rounding policy**, in `apps/web/app/admin/video-generator/race-figures.ts`: total distance in whole kilometres from 10 km (one decimal below); positions and partial lengths with one decimal (",0" dropped in text, kept on the live counter); every D+ computed from the GPX to the nearest 10 m; the announced race D+ as announced (it is the truth, not a measurement, so it is not re-rounded).

4. **Highlights mode behind `storyMode`.** `VideoCompositionSettings.storyMode` is `"full"` (default: the existing flyover, unchanged) or `"highlights"`. Highlights mode keeps 3 to 5 deterministic moments (`highlights.ts`), dwells on each and jumps between them in about 1.2 s, aims at 30-45 s and is capped at 50 s; the script route sizes words for that length and keeps the no-invented-numbers rule.
5. **Narrations keyed by (race_id, mode).** Each mode has its own beat ids (highlights use `hl-…`, intro and outro included), so a race gets one saved narration per mode: migration `20261119120000_add_video_narrations_mode.sql` moves `video_narrations` from a `race_id` key to `(race_id, mode)` with `mode in ('full','highlights')`, existing rows become `full`, the full clips keep `<race_id>.json` and highlights clips use `<race_id>.highlights.json`. The narration routes take `?mode=` (`full` when absent).

6. **Subtitles (phase 3).** The burned-in subtitles are groups of 2 to 5 words (`subtitle-groups.ts`, both story modes) instead of 60-character lines, cut only at natural boundaries: punctuation, a pause over 250 ms between words when start times exist, otherwise between phrases (before a preposition or conjunction). A group never ends on an article, contraction, preposition, determiner, conjunction or clitic (`FRENCH_FUNCTION_WORDS`, `'` and `’`) nor on a bare numeral, never crosses a sentence end, is never a singleton (unless the sentence is one word; a trailing singleton merges into the previous group, up to 6 words), and keeps number + unit ("5 520 m D+", "13 %", "18h12") and consecutive capitalised names ("La Comelle", "Hivernale des Templiers") together. Instagram safe zone: a fixed-width box (x 6 % to 85 %, text centred, one line preferred, two at most, 4.2 cqmin = 45 px at 1080) centred at 64 % of the frame height, so its bottom is at most about 1,300 px of 1920 (assert: 1,500); the Mapbox attribution is not moved. **Optional start times:** ElevenLabs `character_start_times_seconds` are read with the same length check and spoken-to-displayed mapping as the end times and stored as `characterStartMs`, optional in the saved clip and in the render snapshot, so old narrations and snapshots parse and render (pause detection then falls back to punctuation, timing to the end times). The sober karaoke word highlight was not built.

7. **Hook (phase 2).** The first 2.4 s of a reel stop the scroll instead of showing a title card over a static overview. Setting `hookIntro` (null = on for highlights, off for full; the full mode keeps its intro exactly unless it is switched on). From frame 0 the camera already flies the hardest climb (else the first moment) at 58° from the vertical, 3 to 8 km away, orbiting 14° while moving forward, then glides into the chase camera of the first moment through the existing smoothed camera track. The overlay shows one headline figure on one line (at least 14 cqmin; it shrinks rather than wraps) and, from 0.5 to 0.9 s, the short race name, inside the Instagram safe zone; the first moment's caption follows at 2.4 s. Headline figure rule (`pickShockFigure`): 100 km or more → the distance (an ultra length is the most striking fact: « 185 km » for L'Ultra des Druides); otherwise a D+ of at least 30 m/km → the D+ (a clearly hilly course: « 2 276 m D+ » for Astragale Trail, 34 m/km); otherwise the distance. It replaces the suggested « D+ ≥ 3,000 m or ≥ 35 m/km » rule, which put 5,520 m D+ before 185 km for a 30 m/km ultra and 67 km before 2,276 m D+ on a 34 m/km course. The short name is `race_events.short_name` (new nullable column, migration `20261119150000_add_race_events_short_name.sql`, 1-40 characters once trimmed, no « … »; edited by admins in the catalog event dialog) or derived from the event name without year, marks, edition marker or sponsor; never truncated. The hook sentence keeps the `hl-intro` id; the prompt now asks for a question or a strong statement of 12 words at most without unprovided figures.

## Consequences

- Badge, counter, voice, captions, aid cards and AI inputs show the same numbers; the counter ends exactly on the badge total.
- Internal geometry (camera, story cuts, timeline, race clock) stays in GPX kilometres; only display and AI inputs convert. Code that formats a kilometre or a D+ locally reintroduces the bug.
- Aid stations move slightly along the GPX when the race record and the GPX disagree (by the scale factor), so a station sits where its organizer kilometre says relative to the announced total.
- A wrong GPX (or a typo in the race record) beyond the tolerance is not hidden: the GPX wins and the console says why; fixing the data is a catalog task.
- The full mode keeps its timeline and camera behaviour; highlights mode adds its own branch (fixed transits, tighter smoothing, local-speed camera distance) rather than retuning the shared one.
- Highlight ids derive from GPX kilometres (like leg ids), so a GPX replacement re-keys their texts, as it already does for full legs.
- Switching to a mode for the first time restores that mode's saved composition settings too (they decide its beat ids).
- Subtitle timing needs no migration: clips saved before keep working with end times only; regenerating the voice adds start times.
- A hooked reel spends no time on the run-up to its first moment and its first moment absorbs the end of the hook sentence: the fixture reels last 30 s and 39 s (41 s without the hook). Render snapshots saved before the hook lack `hookIntro`, so a highlights snapshot replayed afterwards opens on the hook.
- `race_events.short_name` is read only by admin service-role routes; RLS, grants and public reads are unchanged.
- The previous web version upserts on `race_id` alone: between the migration and the web deploy of the release, its saves fail (reads keep working).

## Related Docs

- `../05-integrations/mapbox-3d.md`
- `../01-architecture/web-app.md`
- `../02-database/tables/video-narrations.md`
- `../02-database/tables/race-events.md`
