---
title: Runner Billing Tables
scope: database
last_verified: 2026-10-30
ai_priority: high
related_files:
  - supabase/migrations/20261030121252_runner_course_access.sql
  - supabase/migrations/20261030121757_runner_purchase_processing.sql
  - apps/web/lib/runner-access.ts
  - apps/web/lib/revenuecat.ts
  - apps/web/app/api/revenuecat/webhook/route.ts
  - apps/web/lib/runner-payments.ts
  - apps/web/app/api/runner/purchase-intents/route.ts
  - apps/web/app/api/runner/purchases/sync/route.ts
  - apps/web/app/api/runner/purchase-authorization/route.ts
  - apps/web/app/api/admin/runner-access-mode/route.ts
related_tables:
  - runner_plan_unlocks
  - runner_subscription_accounts
  - runner_billing_events
  - runner_purchase_intents
  - runner_monetization_config
  - runner_plan_history
  - runner_admin_access_modes
---

# Runner billing tables

## Purpose

These tables are the server-side authority for runner monetisation. The rollout is inert until the singleton `runner_monetization_config.monetization_enabled` is set to `true`; the migration inserts it as `false`.

## Access model

- An annual subscription is global while its verified period is active.
- A one-time purchase is an active `runner_plan_unlocks` row scoped to a server-derived `plan_key` (`race:<race-id>:edition:<edition-id>`); it is therefore reused by plans recreated for the same format and edition.
- `runner_plan_history.detailed_access_granted` preserves read-only detail access for a plan prepared with a genuine subscription, trial or grant after that access expires. A course unlock does not create that history.
- Only verified provider processing may create or change billing records. A client purchase result is not an entitlement.

## Tables

| Table | Role | Client access |
| --- | --- | --- |
| `runner_plan_unlocks` | Durable per-format/edition purchase, with provider transaction id and status. | Owner can read. |
| `runner_subscription_accounts` | Provider subscription account/status/period ledger used alongside the legacy `subscriptions` snapshot. | Service only. |
| `runner_billing_events` | Immutable, provider-event-id-deduplicated webhook event ledger. | Service only. |
| `runner_purchase_intents` | Server-created pending purchase intent, bound to the owner and canonical plan key. | Owner can read. |
| `runner_monetization_config` | One-row rollout switch. | Service only. |
| `runner_plan_history` | Read-only detailed-access provenance for existing plans. | Owner can read. |
| `runner_admin_access_modes` | Session-scoped trusted-admin test mode (`real`, `free`, `premium`). | Service only. |

## RLS and invariants

- Explicit table privileges are revoked from `PUBLIC`, `anon`, and ordinary `authenticated` users except owner `SELECT` on unlocks, intents and history.
- The database derives the canonical key from the owned `race_plans` row; browser-provided race, edition and plan-key values are never authority.
- Provider event/transaction uniqueness makes retries idempotent. Purchase claim and intent fulfillment are one database transaction. The event ledger keeps refund tombstones so a refund delivered before its purchase cannot be reactivated by a late webhook.
- Purchase intents are serialized per user and store, expire after 24 hours, and record whether the native store sheet started. After an app restart, a started intent is reconciled without opening a second charge; an intent that crashed before the store call may safely resume. A store transaction must have been purchased after the intent was created.
- Stripe course Checkout also creates a durable intent and places only its id in signed provider metadata. If the saved plan is deleted while Checkout/store UI is open, fulfillment uses the intent's immutable canonical key, stores a nullable `plan_id`, and applies to a recreated same-edition plan.
- Admin simulation is tied to the authenticated JWT session and trusted Auth `app_metadata`; it cannot create durable billing access.
- With monetisation enabled, anonymous users cannot create plans. Identified users must have the required planning defaults before creation.

## Gotchas

- Do not use `subscriptions` alone to infer a one-time course purchase; it is a global entitlement snapshot.
- Do not enable the rollout flag before Stripe/RevenueCat products, webhook verification, and server credentials are configured and tested.
- Do not grant table writes to mobile or browser clients, including for restore flows.
- The RevenueCat course product must be a repeat-purchasable consumable in both stores. A non-consumable supports only the first course and breaks the per-race model.
- RevenueCat webhook authorization is mandatory and fails closed when its server secret is absent. A recognized event whose database persistence fails returns a retryable non-2xx response.
- RevenueCat `NON_RENEWING_PURCHASE` events can never create Premium, even if the course-product environment is absent. Annual subscription sync requires a configured annual product or exact Premium entitlement plus a finite expiration.
- Refund reversals are idempotent: duplicates and reversal-before-purchase ordering retain an active journal state for the verified claim.

## Related Docs

- [runner_plan_unlocks](runner-plan-unlocks.md)
- [Premium Entitlement](../../03-business-rules/premium-entitlement.md)
- [RLS Policies](../rls-policies.md)
