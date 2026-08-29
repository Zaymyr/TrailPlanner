---
title: Stripe Integration
scope: integration
last_verified: 2026-08-29
ai_priority: high
related_files:
  - apps/web/lib/stripe.ts
  - apps/web/app/api/stripe/checkout/route.ts
  - apps/web/app/api/stripe/portal/route.ts
  - apps/web/app/api/stripe/price/route.ts
  - apps/web/app/api/stripe/webhook/route.ts
  - apps/web/app/api/stripe/webhook/route.test.ts
  - apps/web/app/api/organizer/publication-checkout/route.ts
  - apps/web/app/api/organizer/publication-checkout/route.test.ts
  - apps/web/lib/entitlements.ts
related_tables:
  - subscriptions
  - organizer_edition_payments
  - organizer_edition_entitlements
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
- `STRIPE_CHECKOUT_SUCCESS_URL`
- `STRIPE_CHECKOUT_CANCEL_URL`
- `STRIPE_BILLING_RETURN_URL`
- `STRIPE_ORGANIZER_RACEBOOK_PRICE_ID`
- `STRIPE_ORGANIZER_PRO_PRICE_ID`
- `STRIPE_ORGANIZER_PRO_UPGRADE_PRICE_ID`
- optional organizer checkout success/cancel URL overrides

Product ID and active price ID are not hardcoded in the repo.

<!-- TODO: verify with maintainer: record the Stripe product ID and active price ID from deployment env or Stripe dashboard. -->

## Checkout Flow

`apps/web/app/api/stripe/checkout/route.ts`:

1. Requires Stripe, Supabase anon, and Supabase service config.
2. Verifies bearer access token.
3. Rejects anonymous Supabase users.
4. Applies DB-backed rate limiting: `stripe:checkout:<user.id>`, 5 attempts per minute.
5. Uses request `priceId` or configured `STRIPE_PRICE_ID`.
6. Creates or reuses a Stripe customer.
7. Upserts `subscriptions` with `provider: "web"` and customer id.
8. Creates a subscription checkout session with `client_reference_id = user.id`.

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
- handles organizer async payment success/failure, Checkout expiry, charge refunds, and disputes.

Subscription events upsert:

- `subscriptions.provider = "web"`;
- Stripe customer/subscription ids;
- status;
- price id;
- plan name from price or subscription metadata;
- current period end.

## Organizer Edition Checkout

`/api/organizer/publication-checkout` accepts an event, edition, and target tier only. It verifies the authenticated non-anonymous user, active event membership, edition ownership, publication readiness, current entitlement, and absence of an incompatible active purchase. The server chooses and verifies the configured one-time EUR Price: RaceBook 99 € HT, direct Pro 299 € HT, or RaceBook-to-Pro upgrade 200 € HT.

Checkout enables Stripe Tax, billing address and tax-id collection, and invoice creation. Metadata binds the payment row, edition, user, and transition. The webhook records subtotal, tax, total, currency, Customer, Session, and PaymentIntent before recalculating the effective edition entitlement. A browser success return never grants access by itself.

Any refund event, including partial, marks its organizer transaction refunded; a new dispute marks a paid transaction disputed. Both recalculate the edition and can hide its RaceBooks without hiding its catalog formats. A dispute closed as won restores only a currently disputed transaction; a lost dispute remains invalid. Duplicate or out-of-order webhook delivery is safe because transitions are status-filtered and recalculation derives state from the complete valid ledger.

## Trial vs Paid Distinction

The `subscriptions` table stores billing status. Trial lifecycle for the app's free premium trial is separate and stored in `user_profiles`. Stripe `trialing` status is treated as an active billing status by entitlement code, but it is not the same as the app profile trial.

## Gotchas

- Do not confuse app trial (`user_profiles`) with Stripe trialing subscription status.
- Do not expose Stripe secret keys client-side.
- Webhook handling should remain idempotent; Stripe can retry events.
- `checkout.session.completed` does not include all subscription details, so subscription update events are still important.
- Organizer Price ids must be non-recurring EUR prices, use `tax_behavior=exclusive`, and carry the exact server-expected amounts; never accept a Price id or amount from the browser.
- Organizer payments must not write `subscriptions` or runner Premium state.

## Related Docs

- [Subscriptions Table](../02-database/tables/subscriptions.md)
- [Premium Entitlement](../03-business-rules/premium-entitlement.md)
- [Infrastructure](../01-architecture/infrastructure.md)
- [Session Management](../04-auth-and-security/session-management.md)
- [Organizer Commercial Offers](../03-business-rules/organizer-commercial-offers.md)
