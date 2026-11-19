---
title: Instagram Reels Publishing
scope: integration
last_verified: 2026-11-19
ai_priority: medium
related_files:
  - apps/web/lib/instagram/config.ts
  - apps/web/lib/instagram/crypto.ts
  - apps/web/lib/instagram/crypto.test.ts
  - apps/web/lib/instagram/graph.ts
  - apps/web/lib/instagram/graph.test.ts
  - apps/web/lib/instagram/accounts.ts
  - apps/web/lib/instagram/accounts.test.ts
  - apps/web/lib/instagram/publisher.ts
  - apps/web/lib/instagram/publisher.test.ts
  - apps/web/lib/instagram/runtime.ts
  - apps/web/lib/social-posts.ts
  - apps/web/lib/social-posts.test.ts
  - apps/web/app/api/admin/instagram/route.ts
  - apps/web/app/api/admin/instagram/connect/route.ts
  - apps/web/app/api/admin/instagram/callback/route.ts
  - apps/web/app/api/admin/social-posts/route.ts
  - apps/web/app/api/admin/social-posts/[id]/route.ts
  - apps/web/app/api/cron/social-posts-publish/route.ts
  - apps/web/app/api/cron/social-posts-publish/route.test.ts
  - apps/web/app/api/cron/instagram-token-refresh/route.ts
  - apps/web/app/api/cron/instagram-token-refresh/route.test.ts
  - apps/web/app/admin/publications/page.tsx
  - apps/web/app/admin/publications/PostCard.tsx
  - apps/web/app/admin/publications/CaptionForm.tsx
  - apps/web/app/admin/publications/InstagramConnectionCard.tsx
  - apps/web/app/admin/publications/publications-api.ts
  - apps/web/app/admin/page.tsx
  - apps/web/.env.example
  - supabase/migrations/20261119130000_add_social_posts.sql
  - supabase/migrations/20261119130100_schedule_social_posts_cron.sql
  - supabase/tests/social_posts_checks.sql
  - supabase/tests/social_accounts_checks.sql
related_tables:
  - social_posts
  - social_accounts
  - video_render_jobs
---

# Instagram Reels Publishing

## Purpose

The admin page `/admin/publications` (« Publications », linked from the admin header) turns a finished background render (`video_render_jobs`, status `done`) into an Instagram Reel on the professional account `pace_your.self`. A draft is created first; nothing leaves Pace Yourself until an admin clicks « Publier maintenant » or « Programmer ». The decision record is [2026-11-19 Instagram publishing](../08-decisions/2026-11-19-instagram-publishing.md).

## Key Concepts

- **Instagram API with Instagram Login** (`graph.instagram.com`): no Facebook Page, scopes `instagram_business_basic` and `instagram_business_content_publish`, Standard Access.
- **Long-lived token**: 60 days, stored encrypted (AES-256-GCM) in `social_accounts`, refreshed automatically once 50 days old. There is no manual refresh.
- **Resumable state machine**: a serverless request never waits for Meta. Each step (create the container, poll it, publish it) is one short call, driven by pg_cron every 5 minutes and by the page while it is open.
- **Dry run** (default): the whole flow runs with a simulated Graph client, makes zero call to Meta, and marks the post published with a `dry-run-media-…` id and `dry_run = true`.

## Connecting the account

1. « Connecter Instagram » calls `POST /api/admin/instagram/connect` (admin bearer). It returns `https://www.instagram.com/oauth/authorize?client_id&redirect_uri&response_type=code&scope=instagram_business_basic,instagram_business_content_publish&state=…`. The state is `<expiry>.<nonce>.<HMAC>` bound to the admin id (10 minutes); the nonce is also set in the httpOnly cookie `pace-yourself.instagram-oauth` (path `/api/admin/instagram`).
2. Instagram redirects the browser to `GET /api/admin/instagram/callback?code&state`. The route authenticates the admin from the auth cookie (`trailplanner.access-token`), checks the state and the cookie nonce in constant time, then exchanges the code (`POST https://api.instagram.com/oauth/access_token`, the trailing `#_` stripped) for a short-lived token and that one for a long-lived token (`GET https://graph.instagram.com/access_token?grant_type=ig_exchange_token`). It reads `GET /me?fields=user_id,username` and upserts `social_accounts` on `(platform, ig_user_id)`.
3. It redirects to `/admin/publications?instagram=connected|denied|invalid_state|forbidden|not_configured|error`; the page shows the matching message.

Tokens are never logged and never returned: `GET /api/admin/instagram` exposes only the account id, username, status, expiry and last refresh, plus the mode flags (`dryRun`, `appConfigured`, `encryptionConfigured`). Graph error messages are truncated and stripped of any `access_token=` before they are stored or logged.

## Publishing flow

| Step | Call | Stored at once |
| --- | --- | --- |
| Quota | `GET /{ig-user-id}/content_publishing_limit?fields=config,quota_usage` | usage ≥ total → wait 30 min |
| Container | `POST /{ig-user-id}/media` `media_type=REELS`, `video_url` (2-hour signed GCS URL), `caption` (text + blank line + hashtags), `share_to_feed=true` | `ig_container_id`, `ig_container_created_at` |
| Poll | `GET /{container-id}?fields=status_code,status`, at most once a minute (lease) | `IN_PROGRESS` → wait; `ERROR` / `EXPIRED` → failed, container dropped |
| Publish | `POST /{ig-user-id}/media_publish creation_id=…` only on `FINISHED` and without `ig_media_id` | `publish_requested_at` before, `ig_media_id` right after |
| Permalink | `GET /{media-id}?fields=permalink` (best effort) | `ig_permalink`, status `published` |

Publishing endpoints use the version `INSTAGRAM_GRAPH_API_VERSION` (default `v27.0`, as in Meta's examples; `none` drops the prefix). The OAuth and token endpoints are unversioned, as documented.

- **Signed URL**: generated when the container is created, never when scheduling, with `signStorageUrl` / `getGoogleAccessToken` from `apps/web/lib/video-render.ts` (read-only reuse). `social_posts.video_url` stores the object path `jobs/<job id>/reel.mp4`.
- **Idempotency**: every step runs under a lease (`locked_until`, claimed by a guarded PATCH `status=eq.publishing&or=(locked_until.is.null,locked_until.lt.now)`), so concurrent cron and page calls never run the same step. A stored container is resumed, never re-created. `media_publish` is called only for a `FINISHED` container without `ig_media_id`. A post stuck in `publishing` resumes from its container as soon as its lease expires.
- **After a publish request** (`publish_requested_at` set, `ig_media_id` null: `media_publish` was called and its outcome was not stored): the next step always reads the container status first, before the 24-hour publishing deadline or the container-expiry rule can drop anything. `PUBLISHED` → the reel is looked up among the account's latest media (`GET /{ig-user-id}/media?fields=id,permalink,timestamp,media_product_type&limit=10`, Reels published since the request minus 5 minutes); exactly one match stores its id and permalink, otherwise the post is marked published with « vérifie la publication sur le compte ». `FINISHED` → Meta confirms nothing was published, so `media_publish` runs again. `IN_PROGRESS` → wait. `ERROR`/`EXPIRED` or an unreadable container → failed with every id kept and a message asking to check Instagram first. A new container is never created automatically.
- **Starting over after a publish request**: « Réessayer » in the same mode resumes from the stored container (status check first). Dropping that container (editing a failed post's caption, « Réessayer » after the mode changed, or « Recommencer avec un nouveau conteneur ») answers 409 `needsConfirmation` until the admin confirms, in a dialog, that the reel is not already on Instagram; the request is then resent with `confirmRestart: true`. A simulated request never reached Meta and needs no confirmation.
- **Errors**: Graph code 190/102/10/2xx (or HTTP 401) → the account becomes `needs_reconnect`, the post fails and keeps its container for « Réessayer »; codes 4/17/32/613/80002, subcode 2207042 or HTTP 429 → retry in 15 min; code 9007 → media not ready, retry in 1 min; network, codes 1/2 or HTTP 5xx → retry in 2 min, failed after 8 attempts; anything else → failed with Meta's message. A publication older than 24 h, or a container older than 24 h, fails.
- **Video lifetime**: the bucket deletes objects 30 days after the render. Scheduling is refused after `finished_at + 30 days − 24 h`, and so is « Publier maintenant » or a new container past that point.
- **Caption limits**: 2,200 characters (hashtags included), 30 hashtags (every `#tag` occurrence, list and text), 20 `@mentions`. Hashtags are normalized like the caption generator (lowercase ASCII letters, digits, underscores, unique). Checked in the form, in the API schema and by the `social_posts` check constraints.
- **Dry-run mode flip**: a post keeps the mode it was scheduled in. When `INSTAGRAM_PUBLISH_DRY_RUN` changes, the tick promotes only due posts whose `dry_run` matches the current mode; the others become `failed` with « Programmée en simulation — reprogramme-la pour publier sur Instagram. » (or the reverse message for a post scheduled for real while simulation is active). « Publier maintenant » and « Réessayer » are explicit clicks and use the current mode, which the confirmation dialog states.
- **Quota budget**: 50 posts per 24 h by default when Meta returns no `quota_total` (the docs mention both 50 and 100).

## Scheduler

pg_cron (`20261119130100_schedule_social_posts_cron.sql`) calls `POST /api/cron/social-posts-publish` every 5 minutes and `POST /api/cron/instagram-token-refresh` daily at 04:23 UTC through pg_net, with `Authorization: Bearer <cron_secret>`. Vercel Hobby only allows daily crons, hence pg_cron. Each tick moves due `scheduled` posts to `publishing` (guarded by status, with the current dry-run mode), then advances up to 10 publishing posts whose lease is free. A dry-run post runs to the end within the tick.

The token job refreshes the long-lived token (`GET https://graph.instagram.com/refresh_access_token?grant_type=ig_refresh_token`) once it is 50 days old or expires within 10 days, never before it is 24 h old. An expired or refused token marks the account `needs_reconnect`; another failure keeps the account and records the message for the next day's retry.

## Admin page

- Connection card: account, state, token expiry and last refresh (Europe/Paris), « Connecter / Reconnecter Instagram », and a banner saying whether publishing is simulated.
- « Nouveau brouillon »: renders finished within the last 29 days. The caption starts from a sober template (race title, plan de course, livret coureur) and four generic hashtags; the AI caption route of the video generator is not called because it needs the editor's narration legs (see Gotchas).
- Each post: status and « Simulation » badge, error, permalink, caption preview, signed video preview (« Voir la vidéo »), « Modifier » (draft or failed), « Publier maintenant » (confirmation), « Programmer » (datetime in Europe/Paris, stored UTC; nonexistent DST times are refused), « Annuler la programmation », « Réessayer », « Supprimer » (draft or failed; published history is kept).

## Configuration

Vercel, server-only (names in `apps/web/.env.example`, never values):

- `INSTAGRAM_APP_ID`, `INSTAGRAM_APP_SECRET`: the Instagram app id and secret shown under « API setup with Instagram login ».
- `INSTAGRAM_REDIRECT_URI`: `https://pace-yourself.com/api/admin/instagram/callback` (HTTPS, exactly as registered).
- `SOCIAL_TOKEN_ENCRYPTION_KEY`: 32 random bytes, base64 or hex (`openssl rand -base64 32`), Sensitive.
- `INSTAGRAM_PUBLISH_DRY_RUN`: anything but `false` (or missing Meta credentials) keeps the simulation.
- `INSTAGRAM_GRAPH_API_VERSION` (optional).
- `CRON_SECRET` and the Google Cloud render variables already exist.

### One-time setup

1. Meta app: create an app of type **Business** at developers.facebook.com, add the product **Instagram** and open « API setup with Instagram login ». Add the account `pace_your.self` (professional) as an Instagram tester or app role, request the permissions `instagram_business_basic` and `instagram_business_content_publish`, and register the redirect URI above under « Set up Instagram business login ». Standard Access is enough for our own account.
2. Vercel: set the variables above for Production (and Preview if you test there; a Preview URL needs its own redirect URI registered in Meta).
3. Supabase Vault: the jobs reuse `web_app_url` and `cron_secret` of the organizer import cleanup. If the job `organizer-import-cleanup-hourly` exists in `cron.job`, nothing is needed. Otherwise, in the SQL editor: `select vault.create_secret('https://pace-yourself.com', 'web_app_url');` and `select vault.create_secret('<CRON_SECRET value>', 'cron_secret');`. The jobs pick them up at their next run.
4. Connect: open `/admin/publications`, click « Connecter Instagram », authorize with `pace_your.self`.
5. Test in simulation (default): create a draft, « Publier maintenant », check the « Simulation » badge.
6. Before going live:
   - Make sure the Vault `web_app_url` is the final origin and does not redirect (for example `https://pace-yourself.com`, not `www.` nor a Vercel alias): pg_net does not follow redirects. After the first tick, check `select status_code, content from net._http_response order by created desc limit 5;` (expect 200).
   - Confirm `INSTAGRAM_GRAPH_API_VERSION` with a first real call: `v27.0` comes from Meta's examples and is unconfirmed for `graph.instagram.com`. If the first container creation fails with an unknown-version error, set another version (or `none`) and retry.
7. Go live: set `INSTAGRAM_PUBLISH_DRY_RUN=false` in Vercel and redeploy. Posts already published in simulation stay flagged. Posts scheduled in simulation are not published: they fail at their time and must be rescheduled. A failed simulation post retried after the switch starts a new real container.

## Security

- `social_posts` and `social_accounts` are service-role only (RLS on, no policy, no client grant), like `video_render_jobs`. Every route uses `authorizeVideoAdmin` (trusted `app_metadata` admin role) before the service role; the callback checks the admin from the auth cookie.
- The token is encrypted with a key Supabase never sees; the database only accepts the `v1:` envelope (check constraint).
- Cron routes accept only `Bearer CRON_SECRET`; with no secret configured they reject everything.

## Gotchas

- Unverified against a live Meta app (no credentials during development): the exact response of `me?fields=user_id,username`, the id used for `/{ig-user-id}/media` (we store `user_id` from `/me`; the connection fails without it), `access_token` as a form parameter, the version prefix on `graph.instagram.com`, and the `content_publishing_limit` fields, and the `timestamp` / `media_product_type` fields used to recover a lost media id. Everything is mocked in tests; check the first real publication.
- The cron route signs the Google URL with the Vercel OIDC token of the incoming request: Vercel adds `x-vercel-oidc-token` to function requests, including the pg_net call. If signing fails with « Jeton OIDC Vercel absent », the post retries then fails with that message.
- Rotating `CRON_SECRET` requires updating the Vault `cron_secret`. Changing `SOCIAL_TOKEN_ENCRYPTION_KEY` makes the stored token unreadable: reconnect.
- A post published or scheduled in simulation never reaches Meta, even after dry run is turned off: scheduled posts are refused at promotion and fake ids are refused by the live step.
- The OAuth callback fails the connection when `GET /me?fields=user_id,username` fails or returns no `user_id`; it never falls back to the `user_id` of the code exchange.
- Deleting a render (`video_render_jobs`) sets `social_posts.video_job_id` to null; an unpublished post then fails with « La vidéo de cette publication a été supprimée ».
- `cover_text` is stored for a future generated cover; no `cover_url` is sent yet, so Instagram uses the first frame.
- `content` (jsonb) is reserved for the phase-7 content JSON and unused today.
- The AI caption route (`/api/admin/video-generator/caption`) needs the narration legs computed by the editor; prefilling from it here would duplicate the editor's story logic. Copy the caption from the video generator's Instagram panel when needed.

## Related Docs

- [social_posts](../02-database/tables/social-posts.md)
- [social_accounts](../02-database/tables/social-accounts.md)
- [Google Cloud Background Reel Render](google-cloud-video-render.md)
- [video_render_jobs](../02-database/tables/video-render-jobs.md)
- [Infrastructure](../01-architecture/infrastructure.md)
