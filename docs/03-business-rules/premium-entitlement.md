---
title: Premium Entitlement
scope: business-rule
last_verified: 2026-09-03
ai_priority: high
related_files:
  - apps/web/lib/entitlements.ts
  - apps/mobile/hooks/usePremium.ts
  - apps/mobile/hooks/useRevenueCatBilling.ts
  - apps/mobile/hooks/useProfileScreen.ts
  - apps/mobile/components/premium/PremiumUpsellModal.tsx
  - apps/web/lib/revenuecat.ts
  - apps/web/app/api/stripe/webhook/route.ts
related_tables:
  - subscriptions
  - user_profiles
  - premium_grants
---

# Premium Entitlement

## Purpose

This document explains how Pace Yourself decides whether a user has premium access and which limits apply. Web and mobile use different code paths but converge on `subscriptions`, `user_profiles`, and `premium_grants`.

## Key Concepts

- Entitlement: effective feature access and limits.
- Premium: unlimited plans/favorites/custom products plus export/autofill access.
- Trial: profile-based 15-day premium access.
- Subscription: Stripe or RevenueCat row in `subscriptions`.
- Premium grant: manual override in `premium_grants`.

## Web Entitlements

`apps/web/lib/entitlements.ts` defines default free and premium entitlements.

Free defaults:

- `isPremium: false`
- `planLimit: 1`
- `favoriteLimit: 3`
- `customProductLimit: Infinity`
- `allowExport: false`
- `allowAutoFill: false`

Premium defaults:

- `isPremium: true`
- unlimited plan/favorite/custom product limits;
- export enabled;
- autofill enabled.

<!-- CONFLICT: archived docs/app-rules-and-logic.md says free custom products are limited to 0; current code sets customProductLimit to Infinity. -->

## Resolution Order

Web entitlement resolution checks:

1. User subscription row.
2. Trial state from profile.
3. Active premium grants.

Important behavior:

- `active` and `trialing` subscription statuses are considered active.
- If a subscription has no `current_period_end`, web active-check code can treat it as active.
- Active premium grants can elevate an otherwise free user to premium.

## Mobile Premium Hook

`apps/mobile/hooks/usePremium.ts` combines:

- `user_profiles` trial fields;
- `subscriptions` rows;
- web `/api/entitlements`;
- active `premium_grants`;
- RevenueCat customer info.

If RevenueCat reports an active entitlement but the server row is not synced, mobile calls the web RevenueCat sync endpoint.

An SDK purchase return is not sufficient by itself for success UI or purchase analytics. The billing hook resolves the configured Premium entitlement from the returned `CustomerInfo` and requires it to be active and backed by the same product as the completed transaction before returning `purchased`. A missing, inactive, or mismatched entitlement returns `unverified`, keeps the success alert hidden, and is tracked separately from verified purchases. Sandbox and production purchases can both unlock Premium, but analytics retain their environment distinction.

## Billing Sources

`subscriptions.provider` identifies the billing source:

- `web`: Stripe.
- `google`: RevenueCat/Google Play.
- `apple`: RevenueCat/App Store.

Stripe webhooks store billing metadata on `subscriptions`; entitlement checks do not resolve separate plan-tier tables.

## Business Invariants

- Trial access is 15 days and profile-based.
- Billing source rows all flow into `subscriptions`.
- Premium grants are overrides, not subscriptions.
- Plan creation routes must check effective entitlements before allowing extra saved plans.
- Organizer per-edition Visibilité/RaceBook/Pro rights are a separate commercial model stored in `organizer_edition_entitlements`; they never elevate runner Premium.

## Gotchas

- Do not use archived 14-day trial docs.
- Do not fork mobile purchases into a new table unless changing the entitlement model deliberately.
- Do not treat the existence of a RevenueCat purchase result as a verified Premium purchase; require the active configured entitlement from the returned `CustomerInfo`.
- Be careful with missing `current_period_end`; code paths differ in how permissive they are.
- Stripe product/price identities are environment/dashboard configuration, not hardcoded repo facts.
- Do not resolve organizer edition capabilities from `subscriptions`, RevenueCat, trial state, or `premium_grants`.

## Related Docs

- [Subscriptions Table](../02-database/tables/subscriptions.md)
- [Premium Grants Table](../02-database/tables/premium-grants.md)
- [Trial Lifecycle](trial-lifecycle.md)
- [Stripe](../05-integrations/stripe.md)
