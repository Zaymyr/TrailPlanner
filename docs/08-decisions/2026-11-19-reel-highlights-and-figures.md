---
title: Reel figures and highlights mode
scope: decision
last_verified: 2026-11-19
ai_priority: medium
related_files:
  - apps/web/app/admin/video-generator/race-figures.ts
  - apps/web/app/admin/video-generator/route-story.ts
  - apps/web/app/admin/video-generator/VideoCompositionOverlay.tsx
  - apps/web/app/admin/video-generator/VideoGeneratorMapClient.tsx
related_tables:
  - races
  - race_aid_stations
---

# Reel Figures And Highlights Mode

## Status

Accepted (2026-11-19).

## Context

The admin reel generator (`/admin/video-generator`) showed two different totals for the same race. The badge "N KM" rounded `races.distance_km`, the live counter "KM x / N" rounded the GPX length, and the story, the aid cards and the AI inputs mixed both sources with their own rounding (integer in one place, one decimal in another). Nothing reconciled the race record with the GPX, so a 66.63 km race measured 64.9 km on its GPX could read "67 KM" on the badge and "/ 65" on the counter.

## Decision

1. **The race record is the announced truth.** `races.distance_km` and `races.elevation_gain_m` drive the badge, the intro, the counter total and the race figures sent to the script and caption writers.
2. **The GPX is rescaled to it.** Every GPX kilometre shown (counter, legs, caption ranges, profile ticks, aid cards, script `deKm`/`aKm`, stations flown over) is multiplied by race km ÷ GPX km, and every GPX D+ by race D+ ÷ GPX D+. A race figure is trusted within ±15 % of the GPX length (±35 % for D+, which depends far more on smoothing); otherwise, or when it is missing, the GPX figure is used everywhere (badge included) and the editor logs a warning. Grades and D− stay as measured on the GPX. Organizer station kilometres are in the announced scale and are converted once to place stations on the GPX.
3. **One rounding policy**, in `apps/web/app/admin/video-generator/race-figures.ts`: total distance in whole kilometres from 10 km (one decimal below); positions and partial lengths with one decimal (",0" dropped in text, kept on the live counter); every D+ computed from the GPX to the nearest 10 m; the announced race D+ as announced (it is the truth, not a measurement, so it is not re-rounded).

## Consequences

- Badge, counter, voice, captions, aid cards and AI inputs show the same numbers; the counter ends exactly on the badge total.
- Internal geometry (camera, story cuts, timeline, race clock) stays in GPX kilometres; only display and AI inputs convert. Code that formats a kilometre or a D+ locally reintroduces the bug.
- Aid stations move slightly along the GPX when the race record and the GPX disagree (by the scale factor), so a station sits where its organizer kilometre says relative to the announced total.
- A wrong GPX (or a typo in the race record) beyond the tolerance is not hidden: the GPX wins and the console says why; fixing the data is a catalog task.

## Related Docs

- `../05-integrations/mapbox-3d.md`
- `../01-architecture/web-app.md`
