---
title: Premium Entitlement
scope: business-rule
last_verified: 2026-10-30
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
  - runner_plan_unlocks
---

# Premium Entitlement

## Purpose

This document explains how Pace Yourself decides whether a runner has global premium access or a course-specific purchase. Web and mobile converge on server-verified billing state; a client checkout result is never sufficient.

## Key Concepts

- Entitlement: effective feature access and limits.
- Premium: annual global access while a verified subscription, legacy trial, or grant is active.
- Course unlock: durable edit/detail access for one format + edition, never global Premium.
- Trial: legacy profile-based 15-day premium access; new accounts do not receive one.
- Subscription: Stripe or RevenueCat row in `subscriptions`.
- Premium grant: manual override in `premium_grants`.

## Web Entitlements

`apps/web/lib/entitlements.ts` defines default free and premium entitlements.

When runner monetisation is enabled, identified runners may create multiple free previews. Free previews expose course facts, total estimate, average pace and aggregate nutrition needs, but not detailed pacing, ravito construction, exports or tracking.

Legacy free defaults:

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

Global entitlement resolution checks:

1. User subscription row.
2. Existing trial state from profile (no new trial is initialized).
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

`apps/mobile/hooks/useProfileScreen.ts` consumes this resolved entitlement only for Profile presentation and billing actions; its extracted profile diagnostic helpers do not alter purchase verification or entitlement resolution. The same hook compares editable profile fields with their last persisted values so the save action can remain disabled while the form is unchanged; that dirty-state presentation does not affect Premium resolution.
Retrying the Profile row bootstrap after a recoverable read failure reloads only the existing session/profile form data. It does not grant Premium, bypass `usePremium`, or repeat a billing action.
For trusted admins, the Profile access-mode selector remains a server round trip bound to the current bearer session. Its localized 404/auth failure messages are diagnostic only; the hook updates the displayed mode only after the protected API accepts the change.

If RevenueCat reports an active entitlement but the server row is not synced, mobile calls the web RevenueCat sync endpoint.

The hook exposes one shared external-store snapshot. Its Auth, foreground, premium-status, and RevenueCat listeners are installed once across all mounted consumers; overlapping signals are serialized and coalesced before the Supabase, API, and RevenueCat checks run. Equivalent results do not notify screens again.

An SDK purchase return is not sufficient by itself for success UI or purchase analytics. The billing hook resolves the configured Premium entitlement from the returned `CustomerInfo` and requires it to be active and backed by the same product as the completed transaction before returning `purchased`. A missing, inactive, or mismatched entitlement returns `unverified`, keeps the success alert hidden, and is tracked separately from verified purchases. Sandbox and production purchases can both unlock Premium, but analytics retain their environment distinction.

The mobile Premium upsell sheet identifies its content as a modal accessibility surface and its title as a VoiceOver heading. This is presentation-only: opening, reading, dismissing, or navigating the sheet does not grant Premium and does not bypass the billing hook's verified-purchase requirement.

## Billing Sources

`subscriptions.provider` identifies the billing source:

- `web`: Stripe.
- `google`: RevenueCat/Google Play.
- `apple`: RevenueCat/App Store.

Stripe webhooks store billing metadata on `subscriptions`; entitlement checks do not resolve separate plan-tier tables.

RevenueCat writes a provider-scoped `runner_subscription_accounts` row first. It updates the legacy `subscriptions` projection only when doing so cannot overwrite Stripe customer/subscription identity. New runner-ledger rows with no verified period end are stored expired rather than becoming permanent grants.

## Business Invariants

- Existing trial access remains 15 days and profile-based; it is not created or repaired for new users.
- Annual subscription state can be represented by the legacy `subscriptions` snapshot and the runner billing ledger.
- Premium grants are overrides, not subscriptions.
- Plan creation routes must check effective entitlements before allowing extra saved plans.
- Runner plan purchases are stored in `runner_plan_unlocks` and grant editing only for their canonical course/edition `plan_key`; they never grant global Premium.
- The annual offer is EUR 29.99 TTC; the course offer is EUR 9.99 TTC. Three individual courses cost EUR 29.97, so the annual offer becomes cheaper from a fourth race.
- Subscription expiry keeps historical plan details readable but blocks edits unless that course/edition has a durable unlock.
- Organizer per-edition Visibilité/Essential/Complete/Signature rights are a separate commercial model stored in `organizer_edition_entitlements`; Stripe and manual-payment sources, invoice history, and bank transfers never elevate runner Premium.

## Gotchas

- Do not use archived 14-day trial docs.
- Do not fork mobile purchases into a new table unless changing the entitlement model deliberately.
- Do not treat the existence of a RevenueCat purchase result as a verified Premium purchase; require the active configured entitlement from the returned `CustomerInfo`.
- Be careful with missing `current_period_end`; code paths differ in how permissive they are.
- Stripe product/price identities are environment/dashboard configuration, not hardcoded repo facts.
- Do not resolve organizer edition capabilities from `subscriptions`, RevenueCat, trial state, or `premium_grants`.
- Do not grant runner plan access from a client purchase result; fulfill only from a verified provider webhook.
- The rollout is disabled by default in `runner_monetization_config`; configuration outage or a missing row must not be interpreted as paid access.
- Mobile asks the server for purchase authorization before opening the annual store sheet. Course purchase uses the exact server-returned product id and refuses a stale client/server product mismatch.
- The annual RevenueCat flow selects only the configured annual package from `EXPO_PUBLIC_REVENUECAT_OFFERING_ID`; it fails closed instead of falling back to shorter or lifetime packages, and checks the server product allowlist plus the 29.99 EUR store metadata before purchase.
- Do not move entitlement listeners back into individual hook instances; tab and detail screens frequently mount `usePremium` at the same time.
- Keep accessibility semantics on the Premium upsell presentation-only. Modal focus and headings must not be treated as checkout progress, purchase success, or evidence of an active entitlement.
- Do not couple Profile bootstrap retry to RevenueCat purchase or restore flows; entitlement verification remains owned by the existing Premium and billing hooks.
- Do not make the mobile admin selector optimistic or client-authoritative. API deployment/auth failures must leave the last verified mode unchanged and cannot grant Premium.

## Related Docs

- [Subscriptions Table](../02-database/tables/subscriptions.md)
- [Premium Grants Table](../02-database/tables/premium-grants.md)
- [Trial Lifecycle](trial-lifecycle.md)
- [Stripe](../05-integrations/stripe.md)
