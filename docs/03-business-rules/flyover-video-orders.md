---
title: Organizer Flyover Video Orders
scope: business-rule
last_verified: 2026-11-22
ai_priority: medium
related_files:
  - apps/web/lib/flyover-orders.ts
  - apps/web/lib/flyover-orders.test.ts
  - apps/web/lib/flyover-generation.ts
  - apps/web/lib/flyover-generation.test.ts
  - apps/web/app/survol/page.tsx
  - apps/web/app/survol/flyover-order-form.tsx
  - apps/web/app/survol/commande/[id]/page.tsx
  - apps/web/app/api/flyover-orders/route.ts
  - apps/web/app/api/flyover-orders/[id]/download/route.ts
  - apps/web/app/api/cron/flyover-orders/route.ts
  - supabase/migrations/20261122100000_add_flyover_video_orders.sql
  - supabase/migrations/20261122100100_schedule_flyover_orders_cron.sql
  - supabase/tests/flyover_video_orders_checks.sql
related_tables:
  - flyover_video_orders
  - video_render_jobs
  - social_posts
---

# Organizer Flyover Video Orders

## Purpose

A standalone paid product for race organizers, independent of the livret coureur offers and of the race catalog: on `/survol` an organizer uploads the GPX of a course, names it, optionally lists its aid stations, chooses a basemap and a relief, pays with Stripe, and receives a 3D flyover reel (voice-over and story included) within 24 hours. The video is made by the same building blocks as the [automatic reels](../05-integrations/reel-automation.md) and rendered by the same [Cloud Run job](../05-integrations/google-cloud-video-render.md).

## Key Concepts

- **Offers** (`FLYOVER_OFFERS`, `apps/web/lib/flyover-orders.ts`), per course, prices shown TTC on the page:
  - `collab` — 29.99 €: the reel is published on the Pace Yourself Instagram account at the slot the organizer chose, with the event's account invited as **collaborator** (`social_posts.collaborators`). No download.
  - `download` — 59.99 €: the MP4 (1080 × 1920) is downloadable from the order page for 30 days (bucket lifecycle), free use.
  - Voice-over and story are included in both.
- **Basemap presets** (`FLYOVER_MAP_PRESETS`), mapped on the editor's `mapStyle` + `mapAmbiance`: `signature` (Pace Yourself topo + brand), `satellite` (satellite-streets + natural), `relief` (Standard 3D satellite + vivid), `cinema` (satellite-streets + cinematic).
- **Relief**: `terrain_exaggeration` 1–3 (default 1.8), copied into `terrainExaggeration`.
- **Mode**: same rule as the automatic reels (`getReelMode`): up to 60 km « Parcours complet », beyond « Temps forts ».
- **No catalog race**: the order id stands for the race id inside the in-memory `VideoGeneratorDetail` (`buildFlyoverDetail`); render jobs carry `flyover_order_id` and a null `race_id`.

## Order form (`POST /api/flyover-orders`, multipart)

1. Per-IP rate limit 8/hour; hidden `website` honeypot.
2. Fields (`flyoverOrderFormSchema`): offer, race name (2–120), optional race date, email, Instagram account (required for `collab`; `@` and profile URLs accepted, stored without `@`), preset, relief, collab slot (Paris wall time `YYYY-MM-DDTHH:mm`), up to 40 aid stations `{ name, km }`.
3. Collab slot (`validatePublishLocal`): at least 48 h ahead (24 h production + margin) and at most 21 days ahead (the MP4 expires 30 days after the render).
4. GPX (`checkFlyoverGpx`): ≤ 10 MB, parseable, ≥ 2 points, altitudes on at least half the points (the server cannot query the 3D terrain), 0.5–400 km.
5. Stripe price (env `STRIPE_FLYOVER_COLLAB_PRICE_ID` / `STRIPE_FLYOVER_DOWNLOAD_PRICE_ID`): must be active, EUR, one-off, `unit_amount` 2999 / 5999. The GPX is stored in the private `race-gpx` bucket at `flyover/<order id>.gpx`, the order is inserted `pending_payment` (stations sorted, ids fixed), then a Checkout session opens (`metadata.purchase_type = flyover_video`, `metadata.order_id`, automatic tax, invoice, promotion codes allowed, idempotency key `flyover-order-<id>`). Success URL: the order page; cancel URL: `/survol?paiement=annule`. A failure marks the order `expired`.

## Payment (Stripe webhook)

`checkout.session.completed` (paid) or `async_payment_succeeded` → `paid` (guarded `pending_payment|expired`), then one confirmation email (`flyover/paid/<id>`, never fails the webhook). `expired` / `async_payment_failed` → `expired` (from `pending_payment` only). `charge.refunded` / `charge.dispute.created` → `refunded` (the pipeline stops; a finished video and its scheduled post stay, to be cancelled by hand in Publications).

## Pipeline (`POST /api/cron/flyover-orders`, every 10 min, pg_cron)

One tick (`runFlyoverTick`):

1. Follow `rendering` orders: job `done` → finish (below); job `failed`, missing or stale (`isRenderJobStale`) → failure, back to `scripted`.
2. Resend the ready email of `ready` orders whose email has not gone out.
3. Take the 10-minute lease of the oldest `paid`/`scripted` order and run its step:
   - `paid` → text (`writeReelWork`: place names by Tilequery, AI text; collab captions end with « En collaboration avec @compte ») → `scripted` with `work`.
   - `scripted` → random active pool voice, ElevenLabs (`synthesizeReelClips`), snapshot + render job (`launchReelRender`, `flyover_order_id`, `auto_draft = false`) → `rendering`.
4. A failed step keeps its status, increments `attempts` and stores `error`; after 3 attempts the order is `failed` and the team is emailed (`FLYOVER_NOTIFY_EMAIL`, else `ORGANIZER_DEMO_NOTIFY_EMAIL`, else the support mailbox).

**Finish**: collab → one automatic `social_posts` draft of the job (`auto_generated`, unique per job) with the caption mention and `collaborators = [handle]`, scheduled through `scheduleSocialPostDraft` at `publish_local` in the current publishing mode (dry run included). A refused schedule keeps the draft, sets `error` « Programmation Instagram à faire à la main. » and emails the team. Then `ready` and the ready email to the organizer (`flyover/ready/<id>`): download link, or the scheduled date and the reminder to accept Instagram's collaboration invitation.

## Order page and download

`/survol/commande/<id>?t=<token>` (noindex): status, progress, summary; download button for a ready `download` order. The token is an HMAC of the order id (`FLYOVER_ORDER_TOKEN_SECRET`, else `VIDEO_RENDER_TOKEN_SECRET`, 32+ characters), without expiry. `GET /api/flyover-orders/<id>/download?t=` checks it, then redirects to a 10-minute signed GCS URL (attachment named after the race).

## Setup

- Stripe (live, created 2026-11-22): products `prod_Vg1arNJbhugHeP` (collab, price `price_1UefXIKx7UzLxCDidI1o2mYP`, 29.99 EUR) and `prod_Vg1aoMvRMRBmfL` (download, price `price_1UefXPKx7UzLxCDiHsKPLlyJ`, 59.99 EUR), one-off, `tax_behavior = inclusive` (TTC, account default tax code). Vercel production and preview: `STRIPE_FLYOVER_COLLAB_PRICE_ID`, `STRIPE_FLYOVER_DOWNLOAD_PRICE_ID`. The webhook endpoint needs no new event.
- Testing without paying: a 100 % coupon restricted to these two products (`snrAVyI3`, metadata `purpose=internal_test`) with an internal promotion code (25 uses, the code is not stored in the repo). Checkout then completes with `payment_status = no_payment_required`, handled as paid. Deactivate the promotion code in Stripe if it leaks.
- Optional: `FLYOVER_ORDER_TOKEN_SECRET`, `FLYOVER_NOTIFY_EMAIL`.
- The cron reuses the Vault secrets `web_app_url` and `cron_secret`; the steps reuse the reel env vars (`ANTHROPIC_API_KEY`, `ELEVENLABS_API_KEY`, Google Cloud render variables, `NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN`, Resend).

## Gotchas

- The collab reel goes out only if publishing is live (`INSTAGRAM_PUBLISH_DRY_RUN=false`); in dry run the post is "published" in simulation and the organizer sees no reel.
- The collaborator must accept Instagram's invitation; the API cannot force it. A private or misspelled account makes the container creation fail at publication time (visible in Publications).
- Flyover jobs are hidden from the Publications "videos to publish" list (`flyover_order_id=is.null`): a download video is never offered for publication by mistake.
- A refund after the video is ready does not unschedule the collab post.
- Prices are TTC (`tax_behavior = inclusive`), as shown on `/survol`; the order route checks the amount, not the tax behavior.
- Only the production deployment handles the Stripe webhook and runs the cron (Vault `web_app_url`): pay a test order only once this code is in production, otherwise the production webhook handles the `flyover_video` checkout as a subscription checkout.

## Related Docs

- [flyover_video_orders](../02-database/tables/flyover-video-orders.md)
- [Automatic Reel Pipeline](../05-integrations/reel-automation.md)
- [Google Cloud Background Reel Render](../05-integrations/google-cloud-video-render.md)
- [Instagram Reels Publishing](../05-integrations/instagram-publishing.md)
- [Stripe](../05-integrations/stripe.md)
