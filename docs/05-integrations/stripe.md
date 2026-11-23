---
title: Stripe Integration
scope: integration
last_verified: 2026-11-23
ai_priority: high
related_files:
  - apps/web/lib/admin-runner-profile.ts
  - apps/web/lib/admin-billing-server.ts
  - apps/web/lib/admin-service-rest.ts
  - apps/web/lib/stripe.ts
  - apps/web/app/api/stripe/portal/route.ts
  - apps/web/app/api/stripe/price/route.ts
  - apps/web/app/api/stripe/webhook/route.ts
  - apps/web/app/api/stripe/webhook/route.test.ts
  - apps/web/app/api/flyover-orders/route.ts
  - apps/web/app/api/organizer/invoices/[paymentId]/download/route.ts
  - apps/web/app/api/organizer/invoices/[paymentId]/download/route.test.ts
  - apps/web/app/api/organizer/publication-checkout/route.ts
  - apps/web/app/api/organizer/publication-checkout/route.test.ts
  - apps/web/lib/organizer-publication-tier.ts
  - apps/web/lib/organizer-publication-tier.test.ts
  - apps/web/lib/entitlements.ts
  - apps/web/app/api/stripe/checkout/route.ts
  - apps/web/lib/admin-system-health-server.ts
  - apps/web/lib/admin-integrations.ts
related_tables:
  - subscriptions
  - organizer_edition_payments
  - organizer_edition_entitlements
  - organizer_invoices
  - user_profiles
---

# Stripe Integration

## Purpose

This document describes both runner web subscriptions and one-time organizer edition purchases. These two entitlement models remain separate.

## Key Concepts

- Checkout session: Stripe-hosted subscription checkout.
- Billing portal: Stripe-hosted customer management.
- Webhook: Stripe event handler that updates Supabase.
- Price id: active Stripe price configured by environment.
- Plan name: optional billing metadata stored on the subscription row.

## Configuration

`apps/web/lib/stripe.ts` reads:

- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `STRIPE_PRICE_ID`
- `STRIPE_ANNUAL_PRICE_ID` (runner annual subscription, 29.99 EUR reference price)
- `STRIPE_COURSE_PRICE_ID` (runner one-time course unlock, 9.99 EUR reference price)
- `STRIPE_CHECKOUT_SUCCESS_URL`
- `STRIPE_CHECKOUT_CANCEL_URL`
- `STRIPE_BILLING_RETURN_URL`
- `STRIPE_ORGANIZER_ESSENTIAL_PRICE_ID`
- `STRIPE_ORGANIZER_COMPLETE_PRICE_ID`
- `STRIPE_ORGANIZER_SIGNATURE_PRICE_ID`
- `STRIPE_ORGANIZER_ESSENTIAL_TO_COMPLETE_PRICE_ID`
- `STRIPE_ORGANIZER_ESSENTIAL_TO_SIGNATURE_PRICE_ID`
- `STRIPE_ORGANIZER_COMPLETE_TO_SIGNATURE_PRICE_ID`
- `STRIPE_FLYOVER_COLLAB_PRICE_ID` (organizer flyover video, collab offer, 29.99 EUR) and `STRIPE_FLYOVER_DOWNLOAD_PRICE_ID` (MP4 offer, 59.99 EUR), both optional in the schema and checked by the order route
- legacy RaceBook/Pro Price IDs as temporary compatibility fallbacks
- optional organizer checkout success/cancel URL overrides

Product ID and active price ID are not hardcoded in the repo.

Runner offers are strict: `STRIPE_ANNUAL_PRICE_ID` and `STRIPE_COURSE_PRICE_ID` must each be configured. The annual runner offer never falls back to the legacy `STRIPE_PRICE_ID`; missing configuration produces an explicit unavailable state in the API and UI.

<!-- TODO: verify with maintainer: record the Stripe product ID and active price ID from deployment env or Stripe dashboard. -->

## Checkout Flow

`apps/web/app/api/stripe/checkout/route.ts`:

1. Requires Stripe, Supabase anon, and Supabase service config.
2. Verifies bearer access token.
3. Rejects anonymous Supabase users.
4. Requires the runner rollout flag and real (non-simulated) admin mode, then applies DB-backed rate limiting: `stripe:checkout:<user.id>`, 5 attempts per minute.
5. Rejects an already active annual subscription or an already unlocked course, then selects and validates the server-configured 29.99 EUR annual or 9.99 EUR one-time Price.
6. Creates or reuses a Stripe customer.
7. Upserts `subscriptions` with `provider: "web"` and customer id.
8. Creates a subscription checkout session with `client_reference_id = user.id`.

Runner course checkout uses Checkout mode `payment` and requires a race or edition context. The server writes the purchase type and context into Checkout Session and PaymentIntent metadata; fulfillment belongs to the verified webhook and never to the success URL. Runner course payments must remain separate from `subscriptions` and must not elevate global Premium.

## Portal Flow

`apps/web/app/api/stripe/portal/route.ts`:

- verifies bearer token;
- rate limits `stripe:portal:<user.id>`;
- creates or reuses a Stripe customer;
- creates a billing portal session using `STRIPE_BILLING_RETURN_URL`.

## Price Flow

`apps/web/app/api/stripe/price/route.ts`:

- requires `STRIPE_PRICE_ID`;
- rate limits by client IP/global key;
- fetches `/v1/prices/<priceId>`;
- returns normalized currency, amount, interval, and interval count;
- caches the response for 5 minutes in process memory.

## Webhook Flow

`apps/web/app/api/stripe/webhook/route.ts`:

- verifies `stripe-signature` using `STRIPE_WEBHOOK_SECRET`;
- handles `customer.subscription.created`;
- handles `customer.subscription.updated`;
- handles `customer.subscription.deleted`;
- handles `checkout.session.completed`.
- handles `checkout.session.async_payment_succeeded` for runner and organizer fulfillment.
- handles organizer async payment success/failure, Checkout expiry, charge refunds, and disputes.
- routes `checkout.session.*` events whose `metadata.purchase_type` is `flyover_video` to `handleFlyoverCheckout` first (before the organizer and runner branches); `charge.refunded` and `charge.dispute.created` also mark matching flyover orders `refunded` (`refundFlyoverOrdersByIntent`, also from `cancelled`); the flyover confirmation email is only sent for an order in progress, never for a cancelled one paid late. Organizer, runner and subscription handling is unchanged.

Subscription events upsert:

- `subscriptions.provider = "web"`;
- Stripe customer/subscription ids;
- status;
- price id;
- plan name from price or subscription metadata;
- current period end.

Runner course events are journaled before the atomic claim RPC. A rejected claim returns HTTP 500 so Stripe retries; refund events create a terminal transaction tombstone before revocation, making out-of-order delivery safe.
Course Checkout first creates a durable server intent and carries its id in Stripe metadata, so deleting the plan before settlement does not orphan a valid charge. Runner disputes are journaled too: opening or losing one revokes access, while a won dispute restores only the same provider transaction.

## Organizer Edition Checkout

`/api/organizer/publication-checkout` accepts an event, edition, target tier, and optional publication intent. It verifies the authenticated non-anonymous user, active event membership, edition ownership, publication readiness, current entitlement, and absence of an incompatible active purchase. The server chooses and verifies one of six configured one-time EUR Prices: direct Essential/Complete/Signature at 199/349/499 € HT, Essential-to-Complete at 150 € HT, Essential-to-Signature at 300 € HT, or Complete-to-Signature at 150 € HT. Expected amounts derive from `ORGANIZER_TIER_PRICE_EUR`; after a price change, new Stripe Prices must be created and the six price-id env vars updated in the same release, otherwise checkout fails closed with a configuration error.

Checkout enables Stripe Tax, billing address and tax-id collection, and invoice creation. Metadata binds the payment row, edition, user, and transition. The webhook records subtotal, tax, total, currency, Customer, Session, PaymentIntent, and the Checkout Session Invoice before recalculating the effective edition entitlement. A browser success return never grants access by itself. When the checkout was opened from the publication action, the return marker only asks the dashboard to wait for that trusted entitlement and then call the normal protected edition publication route; URL parameters cannot publish directly.

The authenticated organizer invoice download route retrieves `invoice_pdf` from the stored Invoice id. For historical rows without that id, it retrieves the bound Checkout Session once, persists its Invoice reference, then resolves the PDF. A missing Invoice or `invoice_pdf` is returned as “still being prepared”; Stripe identifiers are never returned in the organizer list DTO.

Independent manual invoices do not call Stripe and do not create or recalculate an organizer entitlement. Their issue, correction, due date and complete bank-transfer settlement live in `organizer_invoices`; gifted features have no standalone price and do not affect pack totals. This separation does not change webhook-confirmed Stripe fulfillment, which continues to activate the purchased edition tier automatically.

Before creating the Checkout Session, the server recomputes the minimum publication tier from selected, populated persisted modules and records that recommendation in Checkout and PaymentIntent metadata. The requested target tier still determines the server-owned Price: choosing a lower paid tier is valid, with higher-tier draft sections retained but excluded from public responses.

`supporter_points`, presented to organizers as **Suivi coureur**, is a default-enabled Essential format module. Its inclusion in the server-side module set, including the compatibility default for an omitted legacy setting, does not create a distinct Price or raise the publication recommendation above Essential.

Any refund event, including partial, marks its organizer transaction refunded; a new dispute marks a paid transaction disputed. Both recalculate the edition and can hide modules or the complete RaceBook without hiding catalog formats. An upgrade is valid only while its paid base path remains valid. A dispute closed as won restores only a currently disputed transaction; a lost dispute remains invalid. Duplicate or out-of-order webhook delivery is safe because transitions are status-filtered and recalculation derives state from the complete valid ledger.

## Organizer flyover video checkout (2026-11-22)

The Checkout opens only from the last step of `/survol`, after the live preview; the order now also stores the chosen story mode (no Stripe change) (route behavior unchanged apart from the GPX waypoint fallback for aid stations).

`POST /api/flyover-orders` opens a one-off Checkout for the `/survol` product (price from `STRIPE_FLYOVER_*_PRICE_ID`, active, EUR, one-off, exact amount; automatic tax, tax-id collection, invoice; `metadata.purchase_type = flyover_video`, `metadata.order_id`). The webhook only moves the `flyover_video_orders` row (`paid`, `expired`, `refunded`) and sends the confirmation email; it writes no `subscriptions`, runner or organizer ledger row. Rules and setup: [Organizer Flyover Video Orders](../03-business-rules/flyover-video-orders.md).

## Admin webhook health (2026-11-23)

Lot 3 of the admin console reads the webhook's health from what it already writes, without any Stripe API call (`loadPaymentActivity` in `lib/admin-system-health-server.ts`, thresholds in `lib/admin-system-health.ts`). Latest event: the newest of `runner_billing_events.received_at` (provider `stripe`), `organizer_edition_payments.updated_at` of rows with a Checkout Session (bank transfers left out) and `flyover_video_orders.paid_at`. Error: `STRIPE_SECRET_KEY` or `STRIPE_WEBHOOK_SECRET` missing, or a Stripe `runner_billing_events` row of the last 7 days still without `processed_at` 15 minutes after `received_at` (the webhook journals, processes, then marks; a throw in between leaves it unprocessed) or with `processing_error` (no code writes a non-null value today). Warning: Stripe organizer payments `failed` or `disputed` updated in the last 7 days. An error line becomes a « Système » item of the admin queue; `/admin/system/integrations` shows which Stripe variables are present (never their value) and the latest event per source. Only the runner ledger is journaled per event: organizer and flyover events are seen through the rows they update.

## Admin sales register (2026-11-23)

Lot 4 of the admin console lists Stripe transactions from the tables the webhook already writes, without any Stripe API call or secret: organizer packs (`organizer_edition_payments` with their stored HT / tax / TTC; abandoned `expired` Checkout attempts are not listed), flyover orders (`flyover_video_orders.amount_cents`, TTC; tax not stored) and runner purchases (`runner_plan_unlocks`, `runner_subscription_accounts`: no amount stored, shown « montant non suivi »). Dashboard links are built from the id prefix only (`pi_` / `ch_` / `py_` → payments, `in_` → invoices, `sub_` → subscriptions); Checkout Session ids get no link. The webhook health line now opens the register (`/admin/billing`), whose banner links back to Intégrations. Data API helpers of the health loader moved to `lib/admin-service-rest.ts` (no behaviour change).

## Trial vs Paid Distinction

The `subscriptions` table stores billing status. Trial lifecycle for the app's free premium trial is separate and stored in `user_profiles`. Stripe `trialing` status is treated as an active billing status by entitlement code, but it is not the same as the app profile trial.

## Gotchas

- The price route rate limit (20 per minute per client IP) uses the DB-backed `checkRateLimitAsync` (2026-11-22).
- `GET /api/stripe/price` returns HTTP 200 with `available: false` and `price: null` when the requested Price id is absent. Clients must render an unavailable state and must not invent or fall back to a display amount. Successful prices are cached independently per offer.

- Organizer publication checkout scans persisted Supabase content before creating a Stripe Session. The branding probe must select its `edition_id` primary key; selecting a nonexistent generic `id` produces a Data API 400 and Stripe is never reached.
- Do not confuse app trial (`user_profiles`) with Stripe trialing subscription status.
- Do not expose Stripe secret keys client-side.
- Webhook handling should remain idempotent; Stripe can retry events.
- `checkout.session.completed` does not include all subscription details, so subscription update events are still important.
- Organizer Price ids must be non-recurring EUR prices, use `tax_behavior=exclusive`, and carry the exact server-expected amounts; never accept a Price id or amount from the browser.
- Automatic Tax requires the appropriate live Stripe tax registrations; code configuration alone is insufficient.
- Organizer payments must not write `subscriptions` or runner Premium state. The same holds for flyover video orders.
- The two flyover prices exist in live mode (29.99 and 59.99 EUR, `tax_behavior = inclusive`, ids in the flyover business rule); unlike organizer prices, the order route checks the amount but not `tax_behavior`. The flyover Checkout allows promotion codes (internal 100 % test coupon restricted to the two flyover products).
- Runner Checkout uses a bounded server idempotency key, and real Checkout is blocked while monetisation is disabled or an admin simulation is active.

## Related Docs

- [Subscriptions Table](../02-database/tables/subscriptions.md)
- [Premium Entitlement](../03-business-rules/premium-entitlement.md)
- [Infrastructure](../01-architecture/infrastructure.md)
- [Session Management](../04-auth-and-security/session-management.md)
- [Organizer Commercial Offers](../03-business-rules/organizer-commercial-offers.md)
- [Organizer Flyover Video Orders](../03-business-rules/flyover-video-orders.md)

Lot 5 of the admin console: `lib/admin-service-rest.ts` gained `getServiceResponse` (raw response, extra headers such as `Prefer: count=exact`, HTTP status on the thrown error), now also used by the overview and inbox loaders (no behaviour change). The runner profile (`GET /api/admin/users/[id]`) lists the runner's Stripe and store purchases with the billing register's normalisation (`normalizeRunner*`, Stripe dashboard link from the id prefix, no amount); no Stripe API call.
