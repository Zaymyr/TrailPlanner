---
title: Stripe Integration
scope: integration
last_verified: 2026-05-17
ai_priority: high
related_files:
  - apps/web/lib/stripe.ts
  - apps/web/app/api/stripe/checkout/route.ts
  - apps/web/app/api/stripe/portal/route.ts
  - apps/web/app/api/stripe/price/route.ts
  - apps/web/app/api/stripe/webhook/route.ts
  - apps/web/lib/entitlements.ts
related_tables:
  - subscriptions
  - coach_profiles
  - user_profiles
---

# Stripe Integration

## Purpose

This document describes the web billing flow backed by Stripe. Stripe is used for web subscriptions and coach-tier billing metadata.

## Key Concepts

- Checkout session: Stripe-hosted subscription checkout.
- Billing portal: Stripe-hosted customer management.
- Webhook: Stripe event handler that updates Supabase.
- Price id: active Stripe price configured by environment.
- Plan name: optional metadata used to map billing to coach tiers.

## Configuration

`apps/web/lib/stripe.ts` reads:

- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `STRIPE_PRICE_ID`
- `STRIPE_CHECKOUT_SUCCESS_URL`
- `STRIPE_CHECKOUT_CANCEL_URL`
- `STRIPE_BILLING_RETURN_URL`

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

Subscription events upsert:

- `subscriptions.provider = "web"`;
- Stripe customer/subscription ids;
- status;
- price id;
- plan name from price or subscription metadata;
- current period end.

They also upsert `coach_profiles` and update `user_profiles` coach status when plan metadata maps to a coach tier.

## Trial vs Paid Distinction

The `subscriptions` table stores billing status. Trial lifecycle for the app's free premium trial is separate and stored in `user_profiles`. Stripe `trialing` status is treated as an active billing status by entitlement code, but it is not the same as the app profile trial.

## Gotchas

- Do not confuse app trial (`user_profiles`) with Stripe trialing subscription status.
- Do not expose Stripe secret keys client-side.
- Webhook handling should remain idempotent; Stripe can retry events.
- `checkout.session.completed` does not include all subscription details, so subscription update events are still important.

## Related Docs

- [Subscriptions Table](../02-database/tables/subscriptions.md)
- [Premium Entitlement](../03-business-rules/premium-entitlement.md)
- [Infrastructure](../01-architecture/infrastructure.md)
- [Session Management](../04-auth-and-security/session-management.md)
