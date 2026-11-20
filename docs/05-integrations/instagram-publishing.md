---
title: Instagram Reels Publishing
scope: integration
last_verified: 2026-11-20
# Reel caption voice (2026-11-20): drafts pre-filled from reel content now carry a livelier caption with a few emojis, distinct from the voice-over; the plain template (no content) is unchanged.
# Admin publications workflow (2026-11-20): shared generate/publish switch, month calendar, list filters, « already published » marks on videos and races, and published posts can be removed from the admin list (never from Instagram).
ai_priority: medium
related_files:
  - apps/web/app/admin/components/AdminWorkspaceNav.tsx
  - apps/web/app/admin/publications/PublicationCalendar.tsx
  - apps/web/app/admin/publications/publication-calendar.ts
  - apps/web/app/admin/publications/publication-calendar.test.ts
  - apps/web/lib/instagram/config.ts
  - apps/web/lib/instagram/graph.ts
  - apps/web/lib/instagram/graph.test.ts
  - apps/web/lib/instagram/publisher.ts
  - apps/web/lib/instagram/publisher.test.ts
  - apps/web/lib/instagram/runtime.ts
  - apps/web/lib/social-posts.ts
  - apps/web/lib/social-posts.test.ts
  - apps/web/app/api/admin/instagram/route.ts
  - apps/web/app/api/admin/instagram/route.test.ts
  - apps/web/app/api/admin/social-posts/route.ts
  - apps/web/app/api/admin/social-posts/[id]/route.ts
  - apps/web/app/api/cron/social-posts-publish/route.ts
  - apps/web/app/api/cron/social-posts-publish/route.test.ts
  - apps/web/app/admin/publications/page.tsx
  - apps/web/app/admin/publications/PostCard.tsx
  - apps/web/app/admin/publications/CaptionForm.tsx
  - apps/web/app/admin/publications/InstagramStatusCard.tsx
  - apps/web/app/admin/publications/publications-api.ts
  - apps/web/app/admin/publications/publication-tabs.ts
  - apps/web/app/admin/publications/publication-tabs.test.ts
  - apps/web/app/admin/publications/RenderActivityCard.tsx
  - apps/web/app/api/admin/render-activity/route.ts
  - apps/web/app/api/admin/render-activity/route.test.ts
  - apps/web/lib/render-activity.ts
  - apps/web/app/admin/publications/AutomationCard.tsx
  - apps/web/app/admin/publications/automation-labels.ts
  - apps/web/app/admin/page.tsx
  - apps/web/.env.example
  - supabase/migrations/20261119130000_add_social_posts.sql
  - supabase/migrations/20261119160000_add_reel_content.sql
  - supabase/migrations/20261119170000_add_render_job_auto_draft.sql
  - apps/web/lib/social-post-auto-draft.ts
  - apps/web/lib/social-post-auto-draft.test.ts
  - apps/web/lib/reel-content.ts
  - apps/web/app/api/admin/social-posts/route.test.ts
  - supabase/migrations/20261119130100_schedule_social_posts_cron.sql
  - supabase/tests/social_posts_checks.sql
  - apps/web/lib/social-post-media.ts
  - apps/web/app/admin/publications/CarouselAutomationSection.tsx
related_tables:
  - social_posts
  - video_render_jobs
---

# Instagram Reels Publishing

## Purpose

The admin page `/admin/publications` (« Publications », linked from the admin header) turns a finished background render (`video_render_jobs`, status `done`) into an Instagram Reel on the professional account `pace_your.self`. A draft is created first; nothing leaves Pace Yourself until an admin clicks « Publier maintenant » or « Programmer », or has turned « Publication automatique » on for automatic reels ([Automatic Reel Pipeline](reel-automation.md)). The decision record is [2026-11-19 Instagram publishing](../08-decisions/2026-11-19-instagram-publishing.md).

## Key Concepts

- **Instagram API with Facebook Login** (`https://graph.facebook.com/<version>`), through the Facebook Page linked to the professional account.
- **System User token** with no expiration (Meta Business Settings), in the server-only env var `IG_SYSTEM_USER_TOKEN`, with the account id in `IG_USER_ID`. There is no OAuth flow, no token storage and no refresh. The token is never logged, returned or stored; Graph error messages are sanitized (any `access_token=` and the token itself are masked) before they are stored or logged.
- **Resumable state machine**: a serverless request never waits for Meta. Each step (create the container, poll it, publish it) is one short call, driven by pg_cron every 5 minutes and by the page while it is open.
- **Dry run** (default): the whole flow runs with a simulated Graph client, makes zero call to Meta, and marks the post published with a `dry-run-media-…` id and `dry_run = true`. Real publication needs `INSTAGRAM_PUBLISH_DRY_RUN=false` **and** both `IG_SYSTEM_USER_TOKEN` and `IG_USER_ID`.

## Publishing flow

All calls go to `https://graph.facebook.com/<INSTAGRAM_GRAPH_API_VERSION>` (default `v27.0`, as in Meta's examples) with the token as the documented `access_token` parameter (query string for GET, form body for POST). Request URLs are never logged.

| Step | Call | Stored at once |
| --- | --- | --- |
| Quota | `GET /{IG_USER_ID}/content_publishing_limit?fields=config,quota_usage` | usage ≥ total → wait 30 min |
| Container | `POST /{IG_USER_ID}/media` `media_type=REELS`, `video_url` (2-hour signed GCS URL), `caption` (text + blank line + hashtags), `share_to_feed=true` | `ig_container_id`, `ig_container_created_at` |
| Poll | `GET /{container-id}?fields=status_code,status`, at most once a minute (lease) | `IN_PROGRESS` → wait; `ERROR` / `EXPIRED` → failed, container dropped |
| Publish | `POST /{IG_USER_ID}/media_publish creation_id=…` only on `FINISHED` and without `ig_media_id` | `publish_requested_at` before, `ig_media_id` right after |
| Permalink | `GET /{media-id}?fields=permalink` (best effort) | `ig_permalink`, status `published` |

- **Signed URL**: generated when the container is created, never when scheduling, with `signStorageUrl` / `getGoogleAccessToken` from `apps/web/lib/video-render.ts` (read-only reuse). `social_posts.video_url` stores the object path `jobs/<job id>/reel.mp4`.
- **Idempotency**: every step runs under a lease (`locked_until`, claimed by a guarded PATCH `status=eq.publishing&or=(locked_until.is.null,locked_until.lt.now)`), so concurrent cron and page calls never run the same step. A stored container is resumed, never re-created. `media_publish` is called only for a `FINISHED` container without `ig_media_id`. A post stuck in `publishing` resumes from its container as soon as its lease expires.
- **After a publish request** (`publish_requested_at` set, `ig_media_id` null: `media_publish` was called and its outcome was not stored): the next step always reads the container status first, before the 24-hour publishing deadline or the container-expiry rule can drop anything. `PUBLISHED` → the reel is looked up among the account's latest media (`GET /{IG_USER_ID}/media?fields=id,permalink,timestamp,media_product_type&limit=10`, `media_product_type=REELS` published since the request minus 5 minutes); exactly one match stores its id and permalink, otherwise the post is marked published with « vérifie la publication sur le compte ». `FINISHED` → Meta confirms nothing was published, so `media_publish` runs again. `IN_PROGRESS` → wait. `ERROR`/`EXPIRED` or an unreadable container → failed with every id kept and a message asking to check Instagram first. A new container is never created automatically.
- **Starting over after a publish request**: « Réessayer » in the same mode resumes from the stored container (status check first). Dropping that container (editing a failed post's caption, « Réessayer » after the mode changed, or « Recommencer avec un nouveau conteneur ») answers 409 `needsConfirmation` until the admin confirms, in a dialog, that the reel is not already on Instagram; the request is then resent with `confirmRestart: true`. A simulated request never reached Meta and needs no confirmation.
- **Errors**: OAuth/permission codes 190, 102, 10, 200-299 (or HTTP 401) → the post fails with « Jeton Instagram invalide ou droits insuffisants — vérifier IG_SYSTEM_USER_TOKEN » and keeps its container for « Réessayer » once the env var is fixed; codes 4/17/32/613/80002, subcode 2207042 or HTTP 429 → retry in 15 min; code 9007 → media not ready, retry in 1 min; network, codes 1/2 or HTTP 5xx → retry in 2 min, failed after 8 attempts; anything else → failed with Meta's message. Missing credentials for a live post → failed with « IG_SYSTEM_USER_TOKEN ou IG_USER_ID absent ». A publication older than 24 h, or a container older than 24 h, fails (unless a publish was requested, see above).
- **Video lifetime**: the bucket deletes objects 30 days after the render. Scheduling is refused after `finished_at + 30 days − 24 h`, and so is « Publier maintenant » or a new container past that point.
- **Caption limits**: 2,200 characters (hashtags included), 5 hashtags (Instagram's limit since late 2025, 30 before; every `#tag` occurrence, list and text), 20 `@mentions`. Hashtags are normalized like the caption generator (lowercase ASCII letters, digits, underscores, unique). Checked in the form, in the API schema and by the `social_posts` check constraints.
- **Dry-run mode flip**: a post keeps the mode it was scheduled in. When `INSTAGRAM_PUBLISH_DRY_RUN` (or the presence of the credentials) changes, the tick promotes only due posts whose `dry_run` matches the current mode; the others become `failed` with « Programmée en simulation — reprogramme-la pour publier sur Instagram. » (or the reverse message for a post scheduled for real while simulation is active). « Publier maintenant » and « Réessayer » are explicit clicks and use the current mode, which the confirmation dialog states.
- **Quota budget**: 50 posts per 24 h by default when Meta returns no `quota_total` (the docs mention both 50 and 100).

## Carousels

Carousel posts (`media_type = carousel`, [Automatic Instagram Carousels](instagram-carousels.md)) go through the same state machine. Step 3a replaces the REELS container: one item container per slide (`POST /{IG_USER_ID}/media` `image_url` = 2-hour signed GET URL of the JPEG, `is_carousel_item=true`), each id stored at once in `ig_child_container_ids` so a retry resumes after the last stored one, then the carousel container (`media_type=CAROUSEL`, `children` in slide order, `caption`) stored in `ig_container_id`. Poll, `media_publish`, permalink, dry run, leases, quota, deadlines and error classes are unchanged; a lost media id is looked up among `FEED` media (reels: `REELS`); dropping the container also clears the item containers (`DROPPED_CONTAINER`). The images live 30 days like the MP4: `getPostMedia` (`lib/social-post-media.ts`) gives the routes the reel's or the carousel's render, so « Programmer », « Publier maintenant » and « Réessayer » apply the same lifetime rule (messages speak of « images »). The post card shows a « Carrousel · série · N images » badge and the slides in order (`previewImages` of `GET /api/admin/social-posts/<id>`, loaded at once for a carousel draft); the calendar marks carousels with ▦ and planned carousel slots in violet. `readPublicationMarks` reads reels only.

## Scheduler

pg_cron (`20261119130100_schedule_social_posts_cron.sql`) calls `POST /api/cron/social-posts-publish` every 5 minutes through pg_net, with `Authorization: Bearer <cron_secret>`. Vercel Hobby only allows daily crons, hence pg_cron. Each tick moves due `scheduled` posts whose mode matches to `publishing` (guarded by status), fails the mismatched ones, then advances up to 10 publishing posts whose lease is free. A dry-run post runs to the end within the tick. The System User token does not expire, so there is no token job.

## Admin page

- Read-only status card (`GET /api/admin/instagram`): credentials configured or not, account username, name and profile picture (`GET /{IG_USER_ID}?fields=username,name,profile_picture_url`), publishing quota, `IG_USER_ID`, `FB_PAGE_ID` (informational), Graph version, and the mode « Simulation » / « Publication réelle ». Meta is read only when both credentials are set; a rejected token shows the token message. The token is never returned. There is no connect button.
- « Nouveau brouillon »: renders finished within the last 29 days. When the render job carries reel content (highlights reels, phase 7), the draft form starts from its caption, hashtags and cover text (`buildDraftPrefill`, `apps/web/lib/reel-content.ts`; the list route returns `defaultCaption`, `defaultHashtags`, `defaultCoverText`, `hasContent`), all editable, and creating the draft copies the job's full content JSON, read server-side from the job row, into `social_posts.content`. Without content (full reels, older renders) the caption starts from a sober template (race title, plan de course, livret coureur) and four generic hashtags, as before. The publisher state machine and the cron are unchanged.
- Automatic drafts (one-click reel): a render launched by « Générer le reel » carries `video_render_jobs.auto_draft`; when it finishes, the render completion route creates the draft itself (`createAutoDraftForRenderJob`, `apps/web/lib/social-post-auto-draft.ts`, service role): status `draft`, `created_by` = the admin who launched the render, pre-filled from the job content like a manual draft, `social_posts.auto_generated = true`. At most one per render (idempotent: existing draft checked first, partial unique index behind it); a creation failure is logged and leaves the render `done`, the admin can still use « Nouveau brouillon ». The post shows a « Généré automatiquement » badge (`PostCard`, from `autoGenerated` of the public post). The draft is reviewed in Publications and published or scheduled by an explicit admin action as usual; the publisher state machine and the cron are unchanged. The manual draft route shares the row builder (`buildSocialPostDraftRow`).
- Each post: status and « Simulation » badge, error, permalink, caption preview, signed video preview (« Voir la vidéo »), « Modifier » (draft or failed), « Publier maintenant » (confirmation), « Programmer » (datetime in Europe/Paris, stored UTC; nonexistent DST times are refused), « Annuler la programmation », « Réessayer », « Recommencer avec un nouveau conteneur » (after a publish request, with confirmation), « Supprimer » (draft or failed) and « Retirer de la liste » (published, simulated or live: the row leaves the admin list only; the Graph API cannot delete an Instagram post, so a live one stays online and must be removed from the Instagram app; the video then loses its « publiée » mark). Scheduled and in-flight posts must be unscheduled or finish first.

- Workflow switch: `AdminWorkspaceNav` (`apps/web/app/admin/components/AdminWorkspaceNav.tsx`) heads both the video generator (« 1 · Générer une vidéo ») and this page (« 2 · Publier »).
- Tabs (2026-11-20, `publication-tabs.ts`, `?onglet=` in the URL): **Agenda** (« À surveiller »: renders running or failed in the last 24 h, posts publishing, failed or waiting for review, then the next 7 days of schedule, each with « Voir »; plus the month calendar), **Reels** (« Nouveau brouillon », « Rendus vidéo », « Reels à publier », « Prochains reels automatiques »), **Carrousels** (« Générer un carrousel », « Rendus des images », « Carrousels à publier », « Prochains carrousels automatiques »), **Publiées** (history, filter Toutes / Reels / Carrousels) and **Paramètres** (Instagram status card, the « Automatisation » switches, the carousel series switches). The header shows the mode (« Simulation » or « En direct sur Instagram »); tab labels carry their counts. « Rendus en cours » come from `GET /api/admin/render-activity` (`apps/web/lib/render-activity.ts`: the last 12 reel and carousel renders, light columns, active ones and those finished in the last 24 h, a readable stage such as « Rendu vidéo · 42 % » or « Capture et envoi des 3 images », lost renders marked failed with the generators' rules), polled every 5 s while a render is active and every minute otherwise; a planned item whose render is running shows that stage, and the posts, plan and slots refresh when a render ends.
- Calendar (Agenda tab): a month calendar (`PublicationCalendar.tsx`, pure grid in `publication-calendar.ts`: Monday-first weeks, posts on their Paris day, published in green, simulated in amber, scheduled in blue, automatic reels planned but not yet scheduled in grey with a dashed border (`groupPlannedByDay`, entries from `toPlannedCalendarEntries`); a click shows the post in the list, or the automation item in its card), then the « Automatisation » card, then the list filtered « À traiter » (default: everything not published), « Publiées », « Toutes ».
- « Automatisation » (`AutomationCard.tsx`, labels in `automation-labels.ts`): the switches « Génération automatique » and « Publication automatique » (the second behind the dialog « Publier sans relecture ? » and an amber warning while on), the caps, and the upcoming automatic reels (race, mode, planned day at 18:00, status, reason of a skip such as « Trop tard — à faire à la main ») with « Exclure » / « Rétablir » and « Recalculer ». See [Automatic Reel Pipeline](reel-automation.md).
- « Programmer » goes through `scheduleSocialPostDraft` (`apps/web/lib/social-posts.ts`: draft only, `validateSchedule`, current dry-run mode, guarded update), shared with the automatic publication, which schedules the automatic draft of a reel at its planned day and time when « Publication automatique » is on. Nothing else in the publisher changes: an automatically scheduled post is published by the same cron tick, in the mode it was scheduled in.
- Duplicates: `readPublicationMarks` (`apps/web/lib/social-posts.ts`) summarises the non-failed posts per video and per race (live publication > simulation > scheduled > draft). The video list prefixes a posted video with ✓ and its mark (« publiée le 12 nov. 2026 »), shows a warning when the chosen video or its race was already published, and asks for confirmation before a second draft. The video generator race picker shows the same mark (race-stats route).

## Configuration

Vercel, server-only (names in `apps/web/.env.example`, never values):

- `IG_SYSTEM_USER_TOKEN`: System User token with no expiration, with the Instagram content publishing permission on the account. **Sensitive.**
- `IG_USER_ID`: Instagram professional account id (numeric) used in `/{IG_USER_ID}/…`.
- `FB_PAGE_ID`: linked Facebook Page id; informational (status card), not needed to publish.
- `INSTAGRAM_PUBLISH_DRY_RUN`: anything but `false`, or missing credentials, keeps the simulation.
- `INSTAGRAM_GRAPH_API_VERSION` (optional, `vNN.N`, default `v27.0`).
- `CRON_SECRET` and the Google Cloud render variables already exist.

### One-time setup

The Meta side (app with Facebook Login, linked Page, System User and its token) is already configured and tested by the user.

1. Vercel Production: add `IG_SYSTEM_USER_TOKEN`, `IG_USER_ID` and `FB_PAGE_ID`, each marked **Sensitive**; leave `INSTAGRAM_PUBLISH_DRY_RUN` unset or `true` at first. Redeploy.
2. Supabase Vault: the cron job reuses `web_app_url` and `cron_secret` of the organizer import cleanup. If the job `organizer-import-cleanup-hourly` exists in `cron.job`, nothing is needed. Otherwise, in the SQL editor: `select vault.create_secret('https://pace-yourself.com', 'web_app_url');` and `select vault.create_secret('<CRON_SECRET value>', 'cron_secret');`. The job picks them up at its next run.
3. Check `/admin/publications`: the status card must show « Identifiants configurés : Oui », the username and the quota. A token message means the token or its permissions are wrong.
4. Test in simulation: create a draft, « Publier maintenant », check the « Simulation » badge.
5. Before going live:
   - Make sure the Vault `web_app_url` is the final origin and does not redirect (for example `https://pace-yourself.com`, not `www.` nor a Vercel alias): pg_net does not follow redirects. After the first tick, check `select status_code, content from net._http_response order by created desc limit 5;` (expect 200).
   - Confirm `INSTAGRAM_GRAPH_API_VERSION` with a first real call: `v27.0` comes from Meta's examples and is not confirmed here. The status card already makes a read call with that version; if it fails with an unknown-version error, set a version Meta accepts.
6. Go live: set `INSTAGRAM_PUBLISH_DRY_RUN=false` in Vercel and redeploy. Posts already published in simulation stay flagged. Posts scheduled in simulation are not published: they fail at their time and must be rescheduled. A failed simulation post retried after the switch starts a new real container.

## Security

- `social_posts` is service-role only (RLS on, no policy, no client grant), like `video_render_jobs`. Every route uses `authorizeVideoAdmin` (trusted `app_metadata` admin role) before the service role.
- No Instagram credential is stored in the database; the token lives only in the server environment and is masked in every stored or logged error.
- The cron route accepts only `Bearer CRON_SECRET`; with no secret configured it rejects everything.

## Gotchas

- Unverified against the real Meta API (no credentials during development, all calls mocked in tests): the `v27.0` version, `access_token` as a form parameter on POST, the `content_publishing_limit` fields, the `username,name,profile_picture_url` fields, and the `timestamp` / `media_product_type` fields used to recover a lost media id. Watch the first real publication.
- If the System User token is ever revoked, publishing fails with the token message: generate a new token in Meta Business Settings, replace `IG_SYSTEM_USER_TOKEN` and redeploy, then « Réessayer » (manual rotation).
- The cron route signs the Google URL with the Vercel OIDC token of the incoming request: Vercel adds `x-vercel-oidc-token` to function requests, including the pg_net call. If signing fails with « Jeton OIDC Vercel absent », the post retries then fails with that message.
- Rotating `CRON_SECRET` requires updating the Vault `cron_secret`.
- A post published or scheduled in simulation never reaches Meta, even after dry run is turned off: scheduled posts are refused at promotion and fake ids are refused by the live step.
- The profile picture comes from Meta's CDN; the report-only CSP does not list it in `img-src`, so it may raise a report.
- Deleting a render (`video_render_jobs`) sets `social_posts.video_job_id` to null; an unpublished post then fails with « La vidéo de cette publication a été supprimée ».
- `cover_text` is stored for a future generated cover; no `cover_url` is sent yet, so Instagram uses the first frame.
- `content` (jsonb) holds the reel content JSON copied at draft creation; the publisher ignores it. `cover_text` comes from it too but, with no `cover_url`, Instagram still uses the first frame: the cover text is only stored.
- Full reels have no stored content: the separate caption route (`/api/admin/video-generator/caption`) needs the narration legs computed by the editor, so copy its caption from the video generator's Instagram panel when needed.

## Related Docs

- [social_posts](../02-database/tables/social-posts.md)
- [Google Cloud Background Reel Render](google-cloud-video-render.md)
- [video_render_jobs](../02-database/tables/video-render-jobs.md)
- [Infrastructure](../01-architecture/infrastructure.md)
- [Automatic Reel Pipeline](reel-automation.md)
