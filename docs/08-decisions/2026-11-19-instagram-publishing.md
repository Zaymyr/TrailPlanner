---
title: Automated Instagram Reels publishing
scope: decision
last_verified: 2026-11-22
ai_priority: medium
related_files:
  - apps/web/lib/instagram/publisher.ts
  - apps/web/lib/instagram/config.ts
  - apps/web/lib/instagram/graph.ts
  - supabase/migrations/20261119130000_add_social_posts.sql
  - supabase/migrations/20261119130100_schedule_social_posts_cron.sql
related_tables:
  - social_posts
---

# Automated Instagram Reels Publishing

## Status

Accepted (revised on 2026-11-19, before release: the Instagram Login + OAuth design was replaced by Facebook Login + System User token).

## Context

The admin renders 3D course reels on Google Cloud (`video_render_jobs`) and posted them to Instagram by hand. The goal is to publish them from the admin, on demand or at a scheduled time, without opening the risk of an unwanted post. Constraints: one professional account (`pace_your.self`), a Vercel Hobby plan (crons once a day only), serverless requests that must not wait minutes for Meta, and MP4s that the bucket deletes after 30 days.

The first version of this decision chose the Instagram API with Instagram Login: an OAuth flow from the admin, a 60-day token encrypted in a `social_accounts` table and a daily refresh job. Before release, the user configured and tested the other variant on the Meta side: the account is linked to a Facebook Page and a System User token with no expiration exists.

## Decision

- **Instagram API with Facebook Login** (`https://graph.facebook.com/<version>`, default `v27.0`), through the linked Facebook Page, because the user already configured and tested it.
- **System User token in a server env var.** `IG_SYSTEM_USER_TOKEN` (no expiration) and `IG_USER_ID` are Vercel Production variables marked Sensitive; `FB_PAGE_ID` is informational. No OAuth flow, no token in the database, no refresh job. The token is never logged, returned or stored, and is masked in every error kept.
- **pg_cron + pg_net scheduler.** Vercel Hobby crons run once a day, so Supabase pg_cron calls the protected publishing route every 5 minutes, reusing the Vault secrets and the `CRON_SECRET` bearer pattern of existing jobs.
- **Resumable state machine.** Container creation, polling and publication are separate short steps under a lease; ids are stored as soon as Meta returns them so any retry resumes and `media_publish` is never called twice.
- **Dry run by default.** Unless `INSTAGRAM_PUBLISH_DRY_RUN` is exactly `false` and both credentials are set, the whole flow runs on a simulated client with zero calls to Meta and flags posts `dry_run`. A post keeps the mode it was scheduled in: after a mode change it fails instead of being promoted, so a simulation can never turn into a real post.
- **No automatic double post.** Once `media_publish` has been called, only the container status decides the next step; a lost response is recovered from the account's latest Reels, and starting over with a new container needs an admin's explicit confirmation.
- **Carousels (2026-11-20).** The same state machine publishes carousels: one item container per JPEG (stored one by one), then the CAROUSEL container, then the usual poll and single `media_publish`; a lost media id is recovered among FEED media. Every guarantee above applies unchanged. See [Automatic Instagram Carousels](../05-integrations/instagram-carousels.md).
- **Human validation guardrail.** Posts start as drafts. Only « Publier maintenant » or « Programmer » clicked by an admin can lead to a publication; the scheduler only executes what an admin scheduled.

## Consequences

- Collaborators (2026-11-22): `social_posts.collaborators` is passed to the REELS container (at most 3), used by the organizer flyover collab offer ([Organizer Flyover Video Orders](../03-business-rules/flyover-video-orders.md)); the state machine and every guarantee above are unchanged, and the invitation must be accepted in Instagram.
- Simpler code and data: no OAuth routes, no encryption key, no account table, no token job.
- A Facebook Page link is required for the account; unlinking it breaks publishing.
- Token rotation is manual: if the System User token is ever revoked, publishing fails with « Jeton Instagram invalide ou droits insuffisants — vérifier IG_SYSTEM_USER_TOKEN » until a new token is set in Vercel. There is no reconnect button.
- The real flow could not be exercised during development: the Graph client is covered by mocked tests only and the first live publication must be watched (see the Gotchas of the integration doc).
- Publishing depends on Supabase cron, Vercel and Google Storage signing through Vercel OIDC in addition to Meta; each failure leaves a readable error on the post and an automatic retry when transient. Rotating `CRON_SECRET` requires updating Vault.

## Related Docs

- [Instagram Reels Publishing](../05-integrations/instagram-publishing.md)
- [social_posts](../02-database/tables/social-posts.md)
- [Google Cloud Background Reel Render](../05-integrations/google-cloud-video-render.md)
