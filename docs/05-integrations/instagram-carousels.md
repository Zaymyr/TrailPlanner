---
title: Automatic Instagram Carousels
scope: integration
last_verified: 2026-11-21
ai_priority: medium
related_files:
  - apps/web/lib/carousels/carousel-format.ts
  - apps/web/lib/carousels/carousel-nutrition.ts
  - apps/web/lib/carousels/carousel-nutrition.test.ts
  - apps/web/lib/carousels/carousel-band.ts
  - apps/web/lib/carousels/carousel-band.test.ts
  - apps/web/lib/carousels/carousel-plan.ts
  - apps/web/lib/carousels/carousel-brief.ts
  - apps/web/lib/carousels/carousel-week.ts
  - apps/web/lib/carousels/carousel-brief-week.test.ts
  - apps/web/lib/carousels/carousel-snapshot.ts
  - apps/web/lib/carousels/carousel-planner.ts
  - apps/web/lib/carousels/carousel-planner.test.ts
  - apps/web/lib/carousels/carousel-automation.ts
  - apps/web/lib/carousels/carousel-automation.test.ts
  - apps/web/lib/carousels/carousel-data.ts
  - apps/web/lib/carousels/carousel-render.ts
  - apps/web/lib/carousels/carousel-writer.ts
  - apps/web/lib/carousels/carousel-generation.ts
  - apps/web/lib/social-post-media.ts
  - apps/web/app/render/carousel/[id]/page.tsx
  - apps/web/app/render/carousel/[id]/RenderCarouselClient.tsx
  - apps/web/app/render/carousel/[id]/CarouselStrip.tsx
  - apps/web/app/render/carousel/[id]/carousel-styles.ts
  - apps/web/app/render/carousel/[id]/carousel-strip.test.ts
  - apps/web/app/api/carousel-render/jobs/[id]/route.ts
  - apps/web/app/api/cron/carousel-automation/route.ts
  - apps/web/app/api/admin/carousel-automation/route.ts
  - apps/web/app/api/admin/carousel-automation/items/[id]/route.ts
  - apps/web/app/admin/publications/CarouselAutomationSection.tsx
  - apps/video-render-worker/render-url.mjs
  - supabase/migrations/20261120180000_add_instagram_carousels.sql
  - supabase/migrations/20261120180100_schedule_carousel_automation_cron.sql
  - supabase/tests/carousel_checks.sql
related_tables:
  - carousel_render_jobs
  - carousel_automation_items
  - social_posts
  - reel_automation_settings
  - races
  - race_aid_stations
  - organizer_edition_entitlements
---

# Automatic Instagram Carousels

## Purpose

Three weekly Instagram carousel series for `pace_your.self`, drawn from the catalog with real figures, rendered to JPEG slides on the existing Cloud Run renderer, drafted in « Publications » and published by the same publisher as the reels. Decision: [ADR decision 16 « Carrousels »](../08-decisions/2026-11-19-reel-highlights-and-figures.md).

| Series | Day (Paris) | Slides | Race |
| --- | --- | --- | --- |
| « Le plan chiffré » (`plan`) | Tuesday | 3 (4 with a « suite ») | 14 to 28 days after the slot, distance and D+ known |
| « Le brief » (`brief`) | Thursday | 3 | 7 to 14 days after the slot, at least one aid station |
| « La semaine qui vient » (`week`) | Sunday | 2 | the races of Monday to Sunday that follows |

Publication time: `reel_automation_settings.publish_time` (18:00 by default).

## Design rules (validated maquettes)

- Portrait slides of 1080 × 1350 (4:5). Nothing in the top-right corner (Instagram's « 1/3 » counter), no slide number of our own, 80 px side margins (3:4 profile-grid crop).
- Brand signature: the blaze (olive `#C8D44E` · amber `#F0873A` · forest `#2D5016`, heights 2:1:4) heads every series; wooden sign plates; topo « cotes » in JetBrains Mono with a spaced capital unit; sand/cream grounds. Fonts: Bricolage Grotesque and JetBrains Mono (next/font, self-hosted). Logos: `public/branding/pace-yourself-logo-mark-{green,white}-transparent.png`.
- Strings and slide text are French; dates are absolute (« 28 NOV. »), never « J−8 ».

### Le plan chiffré

Drawn as ONE continuous strip of `slideCount × 1080` px, then sliced (`CarouselStrip.tsx`).

- **Band** (`carousel-band.ts`): continuous across the strip, under y = 1120; the sky fades in from y = 640 under the content. Ridge on top with a dotted amber trail, flags at start and finish, aid-station plates at their kilometre, a « KM a → b » marker on each slide.
  - Level 1 (GPX): real profile, rescaled to the announced distance (ADR decision 2), elevation mapped to 150 px.
  - Level 2 (aid stations, no GPX): a flat path with the stations at their real km and generic decor mountains whose steepness follows D+/km (seeded, deterministic). Never a fake profile.
  - Level 3 (neither): flat path with kilometre stones every 10 km (5 km under 30 km).
  - A GPX without aid stations stays level 1 (real profile, no plate).
  - Plates: full « KM 17 · Name » when every short name (before « · », « - », « ( », « , ») has 18 characters at most and no two plates or flag labels overlap; otherwise short « KM 58 » plates for all. A short plate that still overlaps goes up one row; with no free row it keeps only its post.
  - Sky: sampled 25 times along the race from the race clock (start time from the organizer schedule, elapsed time of the middle objective) through the solar elevation (`getSunPosition`, `route-clock.ts`): night `#0E1A06` → twilight blue → dawn orange → day blue. Stars over night stretches, the moon in the first one, the sun at the brightest point. No start time: plain day sky. Coordinates: first GPX point, else `races.start_lat/lng`, else France's centre (colour only).
- **Slide 1**: « Combien manger sur {course} {km} km ? », cotes (km, D+, ravitos), the big g/h range, « SUIS LE PARCOURS → ».
- **Slide 2**: objectives as wooden plates (« 12 h »), columns glucides par heure and a dark « glucides au total » column; water and sodium, which the app does not vary with the objective, shown once in a « quel que soit ton objectif » strip under the table (`sharedHydration`; if they ever differ per objective, the eau ml/h and sodium mg/h columns come back); the sentence; grouped bars (g/h light green, total dark green, values on the bars, legend).
- **Slide 3**: « N g de glucides, tronçon par tronçon. » Sections start → aid stations → finish without station names: « KM a → b », length, grams, cumulative gauge (eaten before light green, this section dark green, against the total) with the cumulative figure.
  - ≤ 6 sections: tall rows. 7–14: compact one-line rows with cumulative %. More: sections under 5 km merge into the next one (the last into the previous); still more than 14 → a fourth slide « suite » (rows split in two halves).
  - No aid station: « heure par heure » rows (blocks of whole hours, at most 12 rows).

### Le brief

`carousel-brief.ts`. Night palette when the sun is below −6° at the start, otherwise day.

- Slide 1: cover (eyebrow event · date, « {course} : ce qu’il faut savoir. », cotes, cutoff or aid-station count, « GLISSE → »).
- Slide 2: « Les barrières horaires. » when at least one station has an organizer `cutoffTime` (plus the finish cutoff when given), otherwise « Les ravitos. » with their services (SOLIDE / EAU, EAU SEULEMENT, …). Rows tall up to 5, medium up to 8, compact up to 12; the rest is counted.
- Slide 3: the organizer's livret coureur when the **livret signal** is true, otherwise the plan de course signs. Livret rows only list what the organizer filled in (matériel, dossard, accès, services; « Course » always).

**Livret signal** (`loadCarouselRace`): an active `organizer_edition_entitlements` row of the edition with tier `essential`, `complete` or `signature` (the tiers whose capabilities include `racebook.publish`), **and** `races.racebook_is_live = true` **and** the edition `is_visible`. Only a **paid** livret counts (`isPaidLivretEntitlement` in `carousel-brief.ts`): source `stripe` or `manual_payment`. Admin, complimentary, legacy-admin and system rights do not promote the livret, even though they publish it. A paid livret that is not published yet is not promoted, since runners could not open it.

### La semaine qui vient

`carousel-week.ts`. Relays (`participation_mode = relay`), duos, teams and walks (`relais|relay|duo|team|équipe|marche|rando|walk|nordique` in the format name) are excluded.

- Priority: more formats first, then the longest format, then the name, then the id (deterministic).
- Cover: the carrefour signpost, « LA SEMAINE QUI VIENT », the week range (« 23–29 NOV. »), « SEMAINE 48 · N COURSES » (« · TOUT SE JOUE LE WEEK-END » when every format is on Saturday or Sunday), one plank for each of the first 5 events (« 160 · 80 · 46 KM », a single format adds its D+, a short location is appended when it fits).
- Slide 2: wooden day plates, events indented under each day with a light-green left rule, one two-line tile per format (distance, « D+ x M »). An event on two days appears under both. The race name leads (42 px), formats are secondary (small muted tiles). The footer card « Ta course y est ? » always keeps a 120 px safe margin under it (`WEEK_LIST_BOTTOM_MARGIN`). Overflow: at most 6 events, then the lowest-priority ones are dropped until the list fits `LIST_HEIGHT_BUDGET` (derived from that margin, the footer card and a reserved line, with row heights measured on the rendered slide); the dropped ones are counted (« + N autres courses cette semaine dans l’appli »).

## Numbers

Nothing new is modelled (`carousel-nutrition.ts`):

- **Objectives**: the public course page's three reference levels (`REFERENCE_FLAT_PACES`: 5:00, 6:30, 8:00 min/km flat), through `estimateCourseTime` (planner effort model, aid stations as checkpoints, GPX shape scaled to the official totals), rounded like a runner states a goal (whole hours from 5 h, half hours below). Fast / middle / comfortable; two identical rounded objectives skip the race.
- **Carbs per hour**: the public carb calculator `estimateCarbs(duration, tolerance)` with digestive tolerance 75 / 50 / 25 for the three levels (a confirmed runner's trained gut), validated by the maintainer on 2026-11-20.
- **Water and sodium per hour**: the onboarding estimate `calculateNutrition` (500 ml, +150 ml above 800 m D+; 400 mg). They do not depend on the objective in the app, so slide 2 shows them once, in the shared strip.
- **Totals**: carbs/h × objective hours, rounded to 5 g. **Section grams**: middle objective's carbs/h × each section's estimated duration (rescaled to the rounded objective), allocated in 5 g steps by largest remainder so they add up to the total exactly.
- **Sentence**: true for the figures only: « Plus tu vas vite, plus tu dois manger par heure. » when the faster objective eats more per hour, « Plus tu restes dehors, plus le total grimpe. » when a longer objective eats more in total, « Même rythme par heure : … » when the rates are equal.
- Missing distance, D+, date or a model without a time: the race is skipped (`CarouselSkip`, item `skipped`/`ineligible`), never filled in.

Example, SaintéLyon-like course (80 km, 2 500 m D+, stations at 17, 32, 46, 60, 67 km, no GPX): 10 h / 12 h / 16 h, 75 / 60 / 45 g/h, 650 ml/h, 400 mg/h, totals 750 / 720 / 720 g; middle sections 150, 135, 125, 125, 65, 120 g (= 720). Range « 45–75 », sentence « Plus tu vas vite, plus tu dois manger par heure. » only (the totals do not grow with time).

## Rendering

1. The server builds the snapshot (`carousel-data.ts` reads the race, its stations, GPX, schedule and livret signal with the service role; the pure builders compute every figure and position) and writes the caption.
2. `launchCarouselRender` inserts a `carousel_render_jobs` row (`queued`, snapshot in the row, a few dozen kB) and starts the existing Cloud Run job `video-render` with `RENDER_URL = https://<app>/render/carousel/<id>?w=1080&h=1350#token=…`. The token is the reel HMAC with the scope `carousel-render` (`createRenderToken(…, "carousel-render")`): a reel token never opens a carousel job and the reverse.
3. The worker (`render-url.mjs` accepts `/render/carousel/<id>` and reports failures to `/api/carousel-render/jobs/<id>`) opens the page and waits on `window.__videoRender` as for reels.
4. The page (`RenderCarouselClient.tsx`) fetches the snapshot and one signed PUT URL per slide (`GET /api/carousel-render/jobs/<id>`, job → `running`), waits for every font weight of the self-hosted faces only (`primaryFontFamily`: the next/font stack also names a metric fallback face sourced from `local("Arial")`, absent on the Linux renderer, whose load rejected with « A network error occurred. » and failed the first production render) and every image, checks them with `document.fonts.check`, captures the strip once with `html-to-image` (`toCanvas`, embedded fonts), slices it into 1080 × 1350 canvases and PUTs each as JPEG (quality 0.92) to `carousels/<id>/slide-<n>.jpg`. A failure names its stage (« Polices et images », « Polices embarquées », « Capture », « Envoi de l’image N »).
5. `POST … { status: "done" }` checks every object exists, stores `image_paths` and marks the job `done`; with `auto_draft` it creates the `social_posts` draft (idempotent, partial unique index).

**Why a new table** rather than a kind on `video_render_jobs`: that table requires a race, a video size and an MP4, and its rows count as reels (duplicate guard of the reel planner, « vidéos » counts of the race picker, render list of the video generator). Carousels have no race for « La semaine qui vient », several outputs and their own lifecycle; mixing them would have meant guarding every existing reader.

## Publishing

`social_posts.media_type = 'carousel'` rows carry `carousel_series`, `carousel_job_id`, `image_paths` (object paths, never signed URLs) and `ig_child_container_ids`. The publisher (`lib/instagram/publisher.ts`) keeps every reel guarantee:

1. one item container per image, `POST /{ig-user-id}/media` with `image_url` (2-hour signed URL generated at that moment) and `is_carousel_item=true`; each id is stored as soon as Meta returns it, so a retry resumes after the last stored one;
2. the carousel container, `media_type=CAROUSEL`, `children` (ids in slide order), `caption`; stored in `ig_container_id`;
3. its status polled at most once a minute;
4. `media_publish` once on `FINISHED`, `publish_requested_at` written first;
5. the permalink (best effort). A lost media id is recovered among the account's latest `FEED` media (reels: `REELS`).

Dry run, leases, the 24-hour deadlines, quota wait, error classes, the 5-hashtag limit and the mode-flip rules are unchanged. Dropping a container (expiry, error, restart) also drops the item containers. The images live in the render bucket with the 30-day lifecycle: scheduling and « Publier maintenant » use the carousel render's `finished_at` exactly like a reel's (`getPostMedia`, `lib/social-post-media.ts`).

## Captions

`writeCarouselCaption` (`carousel-writer.ts`): one Claude call per carousel (same model, fallback and structured output as `lib/reel-writer.ts`), lively tone with 2 to 8 emojis, 3 to 5 hashtags (`paceyourself` included), call to action « lien en bio ». Checks, then one low-effort revision, the remaining problems stored as warnings in the content: any number absent from the facts (`findUnprovidedNumbers`), a run of 7 words copied from the slide texts (`findCopiedPhrase`), emoji count, hashtag count, hashtags inside the text. A writer failure retries the step (3 attempts).

## Planning

`planCarousels` (`carousel-planner.ts`, pure), run by every tick and « Recalculer »:

- Slots of each **enabled** series on its weekday from today to today + 21 days, one `carousel_automation_items` row per series and day.
- A slot closer than `lead_days` (3) is skipped « trop tard »; a day already taken by another publication (a locked reel item, a post scheduled outside the carousel slots) is skipped `occupied`; no candidate → `no_candidate`. All three are « semaine sautée » with the reason in the plan.
- Race choice (plan, brief): in the series window, a live solo format with a distance (and a D+ for the plan, aid stations for the brief). Never an edition already used by a slot of the same series, never an edition with a non-failed post or render of the same series in the 180-day window. Then: races without any reel or carousel yet first, with aid stations, with a GPX, the earliest, the longest, the race id.
- Week: planned when the following Monday-Sunday has at least one listed race.
- **Max one post a day across reels and carousels**: the reel planner gets `blockedWeekdays` = the weekdays of the enabled series (`plannerOptionsFrom`), plus the days of carousel slots still waiting (`carouselDates`). Carousel posts are never counted as reels (`media_type=eq.reel` in the reel duplicate guard and in `readPublicationMarks`).

Recomputed: `planned` slots and automatic skips (`too_late`, `no_candidate`, `occupied`) from today on; a past slot still `planned` becomes « trop tard »; past slots stay as history. Locked: everything else, including « Exclure » (`excluded`).

## Executor

`POST /api/cron/carousel-automation` (`CRON_SECRET`), hourly at :47 by pg_cron (the reel job runs at :17). A tick: refresh the plan; follow renders in flight (done → automatic draft linked, `drafted`; failed, deleted or older than 70 min → `failed`); with « Génération automatique » and « Publication automatique » on, schedule each draft at its slot through `scheduleSocialPostDraft`; then, with generation on, one step of one due slot of an enabled series (`planned_publish_date − lead_days ≤ today`, 10-minute lease):

- `content`: duplicate guard again (plan, brief), data + snapshot + caption, stored in `work`. Missing data → `skipped`/`ineligible` with the reason.
- `render`: `launchCarouselRender` with `auto_draft`, owner `reel_automation_settings.updated_by`; slot `rendering`.

Three failed attempts → `failed`.

## Admin

`/admin/publications` (`CarouselAutomationSection.tsx`): series switches in the **Paramètres** tab (`CarouselSeriesSettings`), slots and « Générer un carrousel » in the **Carrousels** tab (`CarouselPlanList`, `CarouselGenerateNow`) next to « Rendus des images » (render stage, elapsed time, failure message):

- one switch per series (`PATCH /api/admin/carousel-automation { plan?, brief?, week? }`, stored in `reel_automation_settings`); the two existing switches (génération, publication automatique) apply to carousels too;
- the slots with status and reason, « Exclure » / « Rétablir » (`PATCH /api/admin/carousel-automation/items/<id>`), « Recalculer » (`POST { action: "refresh" }`);
- « Générer maintenant » (`POST { action: "generate", series, raceId | weekStart }`): builds and renders at once, outside the slots, with an automatic draft; the race picker lists the live formats of the next 42 days, the week picker the next Mondays.
- Carousel drafts show their slides in order (loaded automatically for drafts, « Voir les images » otherwise) with a « Carrousel · série · N images » badge; the calendar marks carousels with ▦ (planned slots in violet).

All routes use `authorizeVideoAdmin`; the render page routes use the carousel-scoped job token.

## Setup

1. Merge applies the migrations (`20261120180000_add_instagram_carousels.sql`, `20261120180100_schedule_carousel_automation_cron.sql`) and redeploys the worker (the workflow triggers on `apps/video-render-worker/**`). Check `select jobname, schedule from cron.job where jobname = 'carousel-automation';`.
2. No new environment variable: Google Cloud render variables, `ANTHROPIC_API_KEY`, `CRON_SECRET`, Instagram variables and the Vault secrets are reused. No bucket change either: its CORS (checked 2026-11-20 by preflight) allows `GET` and `PUT` from any origin with the `Content-Type` header, whatever the type, so the JPEG `PUT` works like the MP4 one.
3. Try « Générer maintenant » once per series and review the drafts; then turn the series on. Leave « Publication automatique » off until a few drafts are reviewed.

## Gotchas

- The renderer still starts the GPU Cloud Run job (same job definition) for a few seconds of rasterisation: correct but not the cheapest.
- The race picker of « Générer maintenant » and the planner read formats by `races.race_date`, or by their edition start when `race_date` is null.
- next/font downloads Bricolage Grotesque and JetBrains Mono at build time; the render page waits for weights 500/700/800 before capturing.
- Start and finish flags are labelled « Départ » / « Arrivée » (the server has no place names for them).
- A `carousel_render_jobs` row with `auto_draft` is drafted once; deleting the draft does not recreate it (the job stays `done`).

## Related Docs

- [Instagram Reels Publishing](instagram-publishing.md)
- [Automatic Reel Pipeline](reel-automation.md)
- [Google Cloud Background Reel Render](google-cloud-video-render.md)
- [carousel_render_jobs](../02-database/tables/carousel-render-jobs.md)
- [carousel_automation_items](../02-database/tables/carousel-automation-items.md)
- [social_posts](../02-database/tables/social-posts.md)

## Admin audit journal (lot 7)

`app/api/admin/carousel-automation/items/[id]/route.ts`, `app/api/admin/carousel-automation/route.ts` now export their write handlers through `withAdminAudit` (`apps/web/lib/admin-audit-log.ts`): each successful or server-failed call writes one best-effort line (`automation.carousel-item`, `automation.carousel-settings`, `automation.carousel-run`) to the admin action journal ([`admin_audit_log`](../02-database/tables/admin-audit-log.md), shown in `/admin/system/audit`). The request and response contracts, the business rules and the schema described here are unchanged.
