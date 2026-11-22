---
title: Automatic Reel Pipeline
scope: integration
last_verified: 2026-11-22
ai_priority: medium
related_files:
  - apps/web/lib/reel-planner.ts
  - apps/web/lib/reel-planner.test.ts
  - apps/web/lib/reel-automation.ts
  - apps/web/lib/reel-automation.test.ts
  - apps/web/lib/reel-generation.ts
  - apps/web/lib/reel-writer.ts
  - apps/web/lib/reel-voice.ts
  - apps/web/lib/video-generator-race.ts
  - apps/web/app/admin/video-generator/reel-composition.ts
  - apps/web/app/admin/video-generator/reel-composition.test.ts
  - apps/web/app/admin/video-generator/video-race-info.ts
  - apps/web/app/api/cron/reel-automation/route.ts
  - apps/web/app/api/cron/reel-automation/route.test.ts
  - apps/web/app/api/admin/reel-automation/route.ts
  - apps/web/app/api/admin/reel-automation/route.test.ts
  - apps/web/app/api/admin/reel-automation/items/[id]/route.ts
  - apps/web/app/admin/publications/AutomationCard.tsx
  - apps/web/app/admin/publications/automation-labels.ts
  - apps/web/app/admin/publications/automation-labels.test.ts
  - supabase/migrations/20261120140000_add_reel_automation.sql
  - supabase/migrations/20261120140100_schedule_reel_automation_cron.sql
  - supabase/tests/reel_automation_checks.sql
  - apps/web/app/admin/publications/CarouselAutomationSection.tsx
related_tables:
  - reel_automation_settings
  - reel_automation_items
  - video_render_jobs
  - video_narrations
  - social_posts
  - races
---

# Automatic Reel Pipeline

## Purpose

Plans from the catalog which races get an Instagram reel and on which day, and, when the admin turns it on, writes the text, voices it, renders it on Google Cloud and creates the Instagram draft without the browser. Optionally it also schedules each draft at its planned slot. Decision: [reel highlights and figures](../08-decisions/2026-11-19-reel-highlights-and-figures.md) (15).

## Key Concepts

- **Plan**: pure function `planReels` (`apps/web/lib/reel-planner.ts`) from plain rows; recomputed at every cron tick and on « Recalculer ».
- **Items**: one `reel_automation_items` row per race and edition (unique), see [reel_automation_items](../02-database/tables/reel-automation-items.md).
- **Switches**: one `reel_automation_settings` row, both off by default, see [reel_automation_settings](../02-database/tables/reel-automation-settings.md).
- **Executor**: `POST /api/cron/reel-automation` (`CRON_SECRET`), called hourly at :17 by pg_cron; each tick runs at most one step of one item, so every request stays short.
- **Same composition as the editor**: `reel-composition.ts` derives figures, beats, writer requests and the render snapshot with the editor's pure modules; the render page replays a server snapshot exactly like a browser one (tested).

## Planning rules (as implemented)

1. **Eligible format** (`isEligibleFormat`): `races.is_live`; name not matching `relais|relay|duo|team` (case-insensitive); `gpx_storage_path` set; `distance_km >= 30`; aid stations are optional since 2026-11-21 (a race without any is told from its GPX alone); format date in the future. Format date = `races.race_date`, else `race_event_editions.start_date`, else `race_events.race_date`.
2. **Mode**: 30-60 km → `full` (« Parcours complet »); over 60 km → `highlights` (« Temps forts »).
3. **Edition** (`getEditionKey`): `edition:<edition_id>`, else `event:<event_id>:<year>`, else `race:<race_id>:<date>`. Event start = earliest date of its eligible formats. Formats publish shortest to longest; the longest at event start − 7 days at the latest, each shorter one at least 7 days before the actual day of the next longer one.
4. **Capacity**: at most `max_per_week` (3) reels per Monday-Sunday week and `max_per_day` (1) per day, Paris days. Editions are assigned in event-start order (earliest first, they have the fewest days left; ties by edition key), each from its longest format down, on the latest free day at or before its target. Days of locked items (generating, rendering, drafted, scheduled) and of posts scheduled by hand (not linked to an item) count in the caps. **Carousels** ([Automatic Instagram Carousels](instagram-carousels.md)): no reel is planned on the weekday of an enabled carousel series (Tuesday plan, Thursday brief, Sunday week: `blockedWeekdays` from `plannerOptionsFrom`), nor on the day of a carousel slot still waiting (`carouselDates`), so there is at most one post a day across reels and carousels; scheduled carousel posts already count as posts scheduled outside the reel items.
5. **Too late**: no valid day on or after today + `lead_days` (3) → skipped `too_late`, shown « Trop tard — à faire à la main ». No compression. The shorter siblings of a too-late format are too late as well.
6. **Duplicate guard**: a race with a non-failed `video_render_jobs` or reel `social_posts` row (`media_type=eq.reel`: a carousel of the race never blocks its reel) created on or after its format date − 180 days is skipped `duplicate`. Window choice: editions are yearly and reels are made in the weeks before a race, so last year's reel of a reused race row is always older than 180 days, while early announcements are still caught. The executor checks again (window from the planned day − 180 days, the item's own render and post excluded) before the text step and before the render step. A failed automatic launch marks its render job failed so it never blocks a retry.
7. **Never twice**: `unique (race_id, edition_key)` on the items; the insert ignores duplicates.

Recomputed at every tick: `planned` items and automatic skips (`too_late`, `duplicate`) are updated or deleted (format gone from the catalog). Locked: everything else, including `skipped`/`excluded` (« Exclure ») and `failed`; an excluded or failed format leaves the edition chain without taking a day.

Defaults: generation `lead_days` = 3 days before the planned day, publication time 18:00 Paris (`publish_time`).

## Executor (one tick)

1. Read the settings, recompute the plan and write the differences (always, switches on or off).
2. Follow renders in flight (always): job `done` → the automatic draft of the job (created by the render completion route, `createAutoDraftForRenderJob`; created here if it failed there) is linked, item `drafted`; job `failed`, deleted or silent (`isRenderJobStale`) → item `failed`.
3. Automatic publication (generation **and** publication switches on): each `drafted` item is scheduled through `scheduleSocialPostDraft` (the « Programmer » rule: future, before the MP4 expires, current dry-run mode) at `planned_publish_date` + `publish_time`, item `scheduled`. A refusal (date passed, video expired) keeps the draft and writes « Programmation automatique impossible : … ».
4. Generation switch off: stop here. Otherwise pick the due item (status `planned` or `generating`, `planned_publish_date − lead_days <= today`, lease free, earliest day first), take its 10-minute lease and run its next step:
   - `content`: race detail (`loadVideoGeneratorDetail`, private GPX), summit and place names (Mapbox Tilequery), beats, then the AI text: one `writeReelContent` call in Temps forts; `writeNarrationScript` then `writeInstagramCaption` in Parcours complet, assembled into the same content JSON (`assembleFullReelContent`: segments, intro's first sentence as hook, outro as call to action, caption, hashtags, short name as cover text; the render race info also carries the format name of the hook, `getReelFormatName`) so its draft is pre-filled too. Stored in `work`.
   - `voice`: a random active pool voice (`pickPoolVoice`, not the previous one of the race), ElevenLabs (`synthesizeNarration`, model v3, expressiveness 0.9 like the editor), then `saveNarration` for the race and mode (overwrites a saved narration of that mode) with the clips.
   - `render`: snapshot (`buildReelRenderSnapshot`, checked by `parseRenderSnapshot`), render job with `content` and `auto_draft = true`, snapshot PUT to Cloud Storage through a signed URL, Cloud Run started (`runRenderJob`, `buildRenderUrl`); item `rendering`.
   A failed step keeps its step, increments `attempts` and stores the error; it runs again at the next tick and the item fails after 3 attempts. A race the server cannot tell (GPX gone or unreadable, GPX without any elevation) becomes `skipped`/`ineligible` with the reason.

Turning generation off stops new work at the next tick; renders in flight finish and get their draft. Items paused between steps resume when it is turned back on.

## Admin page

`/admin/publications` (`AutomationCard.tsx`): the switches live in the **Paramètres** tab (`ReelAutomationSettings`), the upcoming automatic reels in the **Reels** tab (`ReelPlanList`, showing the live render stage of an item being rendered). Routes gated by `authorizeVideoAdmin`:

- `GET /api/admin/reel-automation`: settings (with `carousels`, the three carousel series switches) and items. The carousel section of the same card has its own routes, see [Automatic Instagram Carousels](instagram-carousels.md).
- `PATCH /api/admin/reel-automation` `{ generationEnabled?, autoPublishEnabled?, confirmAutoPublish? }`: turning publication on needs generation and `confirmAutoPublish: true` (409 otherwise), sent after the confirmation dialog « Publier sans relecture ? »; turning generation off turns publication off (also a table check). `updated_by` records the admin: automatic renders, narrations and drafts are created in their name.
- `POST /api/admin/reel-automation` `{ action: "refresh" }`: recompute the plan now; never generates.
- `PATCH /api/admin/reel-automation/items/<id>` `{ action: "exclude" | "include" }`: « Exclure » (planned, failed, automatic skip, or paused between steps; 409 during a step) and « Rétablir » (excluded → planned, the next plan decides).
- The list shows race, mode, planned day and time, status and the reason of a skip or failure. The month calendar shows planned, generating, rendering and drafted items in grey on their day; scheduled ones appear as their post.

## Setup

1. Apply the migrations (merge does it). The pg_cron job `reel-automation` uses the Vault secrets `web_app_url` and `cron_secret` that the social publishing job already reads: nothing to add when `social-posts-publish` works. Check `select jobname, schedule from cron.job where jobname = 'reel-automation';`.
2. The server reuses the existing env vars: `ANTHROPIC_API_KEY`, `ELEVENLABS_API_KEY` (and optional `ELEVENLABS_VOICE_ID`), the Google Cloud render variables, `NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN`, `CRON_SECRET`, `INSTAGRAM_PUBLISH_DRY_RUN`.
3. Open « Publications », press « Recalculer » and check the plan; then turn « Génération automatique » on. Leave « Publication automatique » off until a few automatic drafts have been reviewed.

## Gotchas

- The public Mapbox token may be URL-restricted: server Tilequery calls are then refused, the reel has no summit or start/finish names, and the route logs `Mapbox Tilequery refused (<status>)`. Unrestricting the token for Tilequery (or a server token) restores the names.
- A GPX without any elevation makes the editor fill the profile from the 3D terrain; the server cannot, so the item is skipped (« GPX sans altitudes ») and must be done by hand.
- The render uses the default composition (`DEFAULT_VIDEO_COMPOSITION_SETTINGS` in the planned mode, forced to 1080p because the reel goes to Instagram as is; portrait, preview size 405 × 720), the default speech rate and a random writing style; nothing from the admin's browser (script notes, measured voice pace) applies.
- The voice step overwrites the saved narration of that race and mode, like the one-click reel.
- `created_by` of the automatic render and draft is `reel_automation_settings.updated_by` (null if never set by an admin).
- Planned items move day to day until their generation starts: the plan is recomputed every hour.
- pg_net calls with a 5-minute timeout; the route allows 300 s. One tick does at most one step: a full content step makes two AI calls.
- A crash between the render job insert and its launch leaves an `uploading` job; the next duplicate check then skips the item (safe: never two reels).
- `reel-generation.ts` was refactored on 2026-11-22 so the organizer flyover pipeline can reuse its steps: `writeReelWork` (place names and AI text), `synthesizeReelClips` (voice) and `launchReelRender` (snapshot, render job and launch) are exported, `readWork` too; `runContentStep`, `runVoiceStep` and `runRenderStep` behave as before and call them. See [Organizer Flyover Video Orders](../03-business-rules/flyover-video-orders.md).

## Related Docs

- [Instagram Reels Publishing](instagram-publishing.md)
- [Organizer Flyover Video Orders](../03-business-rules/flyover-video-orders.md)
- [Google Cloud Background Reel Render](google-cloud-video-render.md)
- [Mapbox 3D Admin Course Viewer](mapbox-3d.md)
- [reel_automation_items](../02-database/tables/reel-automation-items.md)
- [reel_automation_settings](../02-database/tables/reel-automation-settings.md)
