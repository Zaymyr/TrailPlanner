---
title: Organizer Flyover Video Orders
scope: business-rule
last_verified: 2026-11-22
ai_priority: medium
related_files:
  - apps/web/lib/flyover-orders.ts
  - apps/web/lib/flyover-orders.test.ts
  - apps/web/lib/flyover-shared.ts
  - apps/web/lib/flyover-admin.ts
  - apps/web/lib/flyover-admin.test.ts
  - apps/web/app/api/admin/flyover-orders/route.ts
  - apps/web/app/api/admin/flyover-orders/[id]/route.ts
  - apps/web/app/admin/publications/FlyoverOrdersCard.tsx
  - supabase/migrations/20261122210000_flyover_orders_cancelled.sql
  - apps/web/app/survol/flyover-preview.tsx
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
  - supabase/migrations/20261122200000_flyover_presets_and_story_mode.sql
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
- **Basemap presets** (`FLYOVER_MAP_PRESETS`), mapped on the editor's `mapStyle`, `customStyleUrl`, `mapAmbiance` and route colour. Offered since 2026-11-22 (`FLYOVER_OFFERED_PRESETS`, four clearly different looks): `signature` (Pace Yourself topo + brand), `satellite` (satellite-streets + natural), `outdoors` « Carte rando » (Mapbox `outdoors-v12` as a custom style + natural), `night` « Nocturne » (satellite-streets + night ambiance, orange route `#f0873a`). `relief` and `cinema` (the first presets, too close to the satellite) stay valid for existing orders but can no longer be ordered.
- **Relief**: `terrain_exaggeration` 1–3 (default 1.8), copied into `terrainExaggeration`.
- **Mode** (`story_mode`, 2026-11-22): the organizer chooses « Temps forts » or « Parcours complet » under the preview; the default is the automatic reel rule (`getFlyoverMode`: up to 60 km full, beyond highlights), also used for older orders whose `story_mode` is null.
- **Opening and subtitles**: like every reel, the video opens on the whole route seen from above, then zooms onto the start or the first moment; subtitles sit at 82 % of the height ([ADR](../08-decisions/2026-11-19-reel-highlights-and-figures.md), decision 20).
- **Shared composition** (`apps/web/lib/flyover-shared.ts`, no server import): presets, relief bounds, `getFlyoverMode`, `applyFlyoverSettings`, `buildFlyoverDetail`, `checkFlyoverGpx`, `readGpxAidStations`. The browser preview and the paid render read the same functions, so what the organizer sees is what is rendered (minus the voice).
- **No catalog race**: the order id stands for the race id inside the in-memory `VideoGeneratorDetail` (`buildFlyoverDetail`); render jobs carry `flyover_order_id` and a null `race_id`.

## Page flow (`/survol`, 2026-11-22)

The price comes last, after the organizer has seen the video:

1. **Votre parcours**: the GPX is read in the browser (`parseGpx`, `checkFlyoverGpx`); its waypoints become editable aid stations (`readGpxAidStations`: `normalizeImportedWaypoints`, start and finish excluded, at most 40) and its `<name>` pre-fills the race name when empty.
2. **Votre vidéo**: format (Temps forts / Parcours complet), basemap and relief, next to the live 3D preview (`FlyoverPreview`: the editor viewer `VideoGeneratorMap` in `preview` mode, with the reel settings of the course mode, the preset and the relief; play, restart and seek; no voice, the default story subtitles play). Route points depend on the GPX only, so typing the name or editing a station never restarts the viewer. On a phone the preview comes first and is sized by the page width.
3. **Votre formule**: the two offers, then the Instagram account, the collab slot and the email appear once an offer is chosen; the pay button is disabled until a GPX is ready.

## Order form (`POST /api/flyover-orders`, multipart)

1. Per-IP rate limit 8/hour; hidden `website` honeypot.
2. Fields (`flyoverOrderFormSchema`): offer, race name (2–120), `storyMode` (optional, `highlights` or `full`; stored as `story_mode`, default from the distance), preset (offered ones only), optional race date, email, Instagram account (required for `collab`; `@` and profile URLs accepted, stored without `@`), preset, relief, collab slot (Paris wall time `YYYY-MM-DDTHH:mm`), up to 40 aid stations `{ name, km }`, `aidStationsEdited` (`1` when the organizer changed the list). When the form sends no station and the list was never edited, the server falls back to the GPX waypoints (`readGpxAidStations`).
3. Collab slot (`validatePublishLocal`): at least 48 h ahead (24 h production + margin) and at most 21 days ahead (the MP4 expires 30 days after the render).
4. GPX (`checkFlyoverGpx`): ≤ 10 MB, parseable, ≥ 2 points, altitudes on at least half the points (the server cannot query the 3D terrain), 0.5–400 km.
5. Stripe price (env `STRIPE_FLYOVER_COLLAB_PRICE_ID` / `STRIPE_FLYOVER_DOWNLOAD_PRICE_ID`): must be active, EUR, one-off, `unit_amount` 2999 / 5999. The GPX is stored in the private `race-gpx` bucket at `flyover/<order id>.gpx`, the order is inserted `pending_payment` (stations sorted, ids fixed), then a Checkout session opens (`metadata.purchase_type = flyover_video`, `metadata.order_id`, automatic tax, invoice, promotion codes allowed, idempotency key `flyover-order-<id>`). Success URL: the order page; cancel URL: `/survol?paiement=annule`. A failure marks the order `expired`.

## Payment (Stripe webhook)

`checkout.session.completed` (paid) or `async_payment_succeeded` → `paid` (guarded `pending_payment|expired`), then one confirmation email (`flyover/paid/<id>`, never fails the webhook, only for an order in progress: a cancelled order paid late gets none). `expired` / `async_payment_failed` → `expired` (from `pending_payment` only). `charge.refunded` / `charge.dispute.created` → `refunded`, also from `cancelled` (the pipeline stops; a finished video and its scheduled post stay, to be cancelled by hand in Publications).

## Pipeline (`POST /api/cron/flyover-orders`, every 10 min, pg_cron)

One tick (`runFlyoverTick`):

1. Follow `rendering` orders: job `done` → finish (below); job `failed`, missing or stale (`isRenderJobStale`) → failure, back to `scripted`.
2. Resend the ready email of `ready` orders whose email has not gone out.
3. Take the 10-minute lease of the oldest `paid`/`scripted` order and run its step:
   - `paid` → text (`writeReelWork`: place names by Tilequery, AI text; collab captions end with « En collaboration avec @compte ») → `scripted` with `work`.
   - `scripted` → random active pool voice, ElevenLabs (`synthesizeReelClips`), snapshot + render job (`launchReelRender`, `flyover_order_id`, `auto_draft = false`) → `rendering`.
4. A failed step keeps its status, increments `attempts` and stores `error`; after 3 attempts the order is `failed` and the team is emailed (`FLYOVER_NOTIFY_EMAIL`, else `ORGANIZER_DEMO_NOTIFY_EMAIL`, else the support mailbox).

**Finish**: collab → one automatic `social_posts` draft of the job (`auto_generated`, unique per job) with the caption mention and `collaborators = [handle]`, scheduled through `scheduleSocialPostDraft` at `publish_local` in the current publishing mode (dry run included). A refused schedule keeps the draft, sets `error` « Programmation Instagram à faire à la main. » and emails the team. Then `ready` and the ready email to the organizer (`flyover/ready/<id>`): download link, or the scheduled date and the reminder to accept Instagram's collaboration invitation.

## Admin (Publications › Survols, 2026-11-22)

`/admin/publications?onglet=flyovers` (`FlyoverOrdersCard.tsx`) lists the 50 latest orders (filter « En cours et à traiter » by default, or all): race, offer, Instagram account and slot, format, basemap, email, payment and delivery times, status, render progress (polled every 15 s while an order is in progress), last error with its attempt count, a 1-hour MP4 download link for a finished render and the customer's order page link. Routes gated by `authorizeVideoAdmin`: `GET /api/admin/flyover-orders` and `PATCH /api/admin/flyover-orders/<id>` `{ action }`. Actions (`planFlyoverAdminAction`, `lib/flyover-admin.ts`, pure and tested; every update is guarded on the current status):

- **Annuler** (`cancel`, any open status: `pending_payment`, `paid`, `scripted`, `rendering`, `ready`, `failed`) → `cancelled` (migration `20261122210000`); the cron never touches it again; a scheduled collab post goes back to draft (it then shows in the Reels tab, to delete or keep). A render already running finishes but is ignored. The refund is done in the Stripe dashboard (its webhook then marks the order `refunded`).
- **Relancer** (`retry`, `failed` or `cancelled`, paid only) → `scripted` when the text was written, else `paid`; attempts, error, render and delivery reset.
- **Réécrire le texte** (`rewrite`, `failed`, `cancelled` or `scripted`) → `paid` with the work dropped: the AI text is written again.
- **Renvoyer l’e-mail** (`resend_ready_email`, `ready`) clears `ready_email_sent_at`; the next tick sends the ready email again (its idempotency key includes the row's `updated_at`, so Resend does not drop it as a duplicate).

## Order page and download

`/survol/commande/<id>?t=<token>` (noindex): status, progress, summary; download button for a ready `download` order. The token is an HMAC of the order id (`FLYOVER_ORDER_TOKEN_SECRET`, else `VIDEO_RENDER_TOKEN_SECRET`, 32+ characters), without expiry. `GET /api/flyover-orders/<id>/download?t=` checks it, then redirects to a 10-minute signed GCS URL (attachment named after the race).

## Setup

- Stripe (live, created 2026-11-22): products `prod_Vg1arNJbhugHeP` (collab, price `price_1UefXIKx7UzLxCDidI1o2mYP`, 29.99 EUR) and `prod_Vg1aoMvRMRBmfL` (download, price `price_1UefXPKx7UzLxCDiHsKPLlyJ`, 59.99 EUR), one-off, `tax_behavior = inclusive` (TTC, account default tax code). Vercel production and preview: `STRIPE_FLYOVER_COLLAB_PRICE_ID`, `STRIPE_FLYOVER_DOWNLOAD_PRICE_ID`. The webhook endpoint needs no new event.
- Testing without paying: a 100 % coupon restricted to these two products (`snrAVyI3`, metadata `purpose=internal_test`) with an internal promotion code (25 uses, the code is not stored in the repo). Checkout then completes with `payment_status = no_payment_required`, handled as paid. Deactivate the promotion code in Stripe if it leaks.
- Optional: `FLYOVER_ORDER_TOKEN_SECRET`, `FLYOVER_NOTIFY_EMAIL`.
- The cron reuses the Vault secrets `web_app_url` and `cron_secret`; the steps reuse the reel env vars (`ANTHROPIC_API_KEY`, `ELEVENLABS_API_KEY`, Google Cloud render variables, `NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN`, Resend).

## Gotchas

- « Annuler » never refunds: refund in Stripe. Cancelling an unpaid order does not close its Checkout session; if the customer still pays, the order stays `cancelled` (no confirmation email) and must be resumed or refunded by hand.

- The preview uses the public Mapbox token in the browser, like the admin editor: each preview loads Mapbox terrain and tiles (map loads count on the Mapbox bill).
- The preview has no voice: the story texts shown are the default beat narrations; the paid video gets AI-written texts and a voice-over.

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
