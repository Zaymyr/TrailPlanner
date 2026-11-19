---
title: Automated Instagram Reels publishing
scope: decision
last_verified: 2026-11-19
ai_priority: medium
related_files:
  - apps/web/lib/instagram/publisher.ts
  - apps/web/lib/instagram/crypto.ts
  - apps/web/lib/instagram/config.ts
  - supabase/migrations/20261119130000_add_social_posts.sql
  - supabase/migrations/20261119130100_schedule_social_posts_cron.sql
related_tables:
  - social_posts
  - social_accounts
---

# Automated Instagram Reels Publishing

## Status

Accepted

## Context

The admin renders 3D course reels on Google Cloud (`video_render_jobs`) and posted them to Instagram by hand. The goal is to publish them from the admin, on demand or at a scheduled time, without opening the risk of an unwanted post. Constraints: one professional account (`pace_your.self`), no Facebook Page, a Vercel Hobby plan (crons once a day only), serverless requests that must not wait minutes for Meta, and MP4s that the bucket deletes after 30 days.

## Decision

- **Instagram API with Instagram Login** (`graph.instagram.com`, scopes `instagram_business_basic` and `instagram_business_content_publish`, Standard Access). It needs no Facebook Page or Business Manager link, which the account does not have, and covers Reels publishing for our own account.
- **Token encrypted in the database, refreshed automatically.** The long-lived token (60 days) is obtained server side through OAuth from the admin, encrypted with AES-256-GCM under `SOCIAL_TOKEN_ENCRYPTION_KEY` and stored in the service-only `social_accounts`. A daily job refreshes it after 50 days. Only app credentials, redirect URI, key and dry-run switch are environment variables; nobody pastes a token anywhere.
- **pg_cron + pg_net scheduler.** Vercel Hobby crons run once a day, so Supabase pg_cron calls protected Next routes every 5 minutes (publishing) and daily (token), reusing the Vault secrets and the `CRON_SECRET` bearer pattern of existing jobs.
- **Resumable state machine.** Container creation, polling and publication are separate short steps under a lease; ids are stored as soon as Meta returns them so any retry resumes and `media_publish` is never called twice.
- **Dry run by default.** Unless `INSTAGRAM_PUBLISH_DRY_RUN` is exactly `false` and the Meta app is configured, the whole flow runs on a simulated client with zero calls to Meta and flags posts `dry_run`.
- **Human validation guardrail.** Posts start as drafts. Only « Publier maintenant » or « Programmer » clicked by an admin can lead to a publication; the scheduler only executes what an admin scheduled.

## Consequences

- The real flow could not be exercised during development (no Meta credentials): the Graph client is covered by mocked tests only and the first live publication must be watched (see the Gotchas of the integration doc).
- Publishing depends on three systems (Supabase cron, Vercel, Google Storage signing through Vercel OIDC) in addition to Meta; each failure leaves a readable error on the post and an automatic retry when transient.
- Rotating `CRON_SECRET` requires updating Vault, and rotating the encryption key requires reconnecting the account.
- Moving to the Facebook Login variant later would change the OAuth and token endpoints but not the tables or the state machine.

## Related Docs

- [Instagram Reels Publishing](../05-integrations/instagram-publishing.md)
- [social_posts](../02-database/tables/social-posts.md)
- [social_accounts](../02-database/tables/social-accounts.md)
- [Google Cloud Background Reel Render](../05-integrations/google-cloud-video-render.md)
