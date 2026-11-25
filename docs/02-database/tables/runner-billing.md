---
title: Runner Billing Tables
scope: database
last_verified: 2026-11-23
ai_priority: high
related_files:
  - supabase/migrations/20261030121252_runner_course_access.sql
  - supabase/migrations/20261030121757_runner_purchase_processing.sql
  - supabase/migrations/20261123220100_record_runner_sale_amounts.sql
  - apps/web/lib/runner-access.ts
  - apps/web/lib/revenuecat.ts
  - apps/web/app/api/revenuecat/webhook/route.ts
  - apps/web/lib/revenuecat-reconciliation.ts
  - apps/web/app/api/cron/revenuecat-reconciliation/route.ts
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

These tables are the server-side authority for runner monetisation. The migration inserts the singleton `runner_monetization_config.monetization_enabled` as `false`; production was explicitly activated on 2026-11-02 at 06:32:21 UTC after the launch cohort and grandfathered-plan snapshots were created atomically.

## Access model

- An annual subscription is global while its verified period is active.
- A one-time purchase is an active `runner_plan_unlocks` row scoped to a server-derived `plan_key` (`race:<race-id>:edition:<edition-id>`); it is therefore reused by plans recreated for the same format and edition.
- `runner_plan_history.detailed_access_granted` preserves read-only detail access for a plan prepared with a genuine subscription, trial or grant after that access expires. A course unlock does not create that history.
- Only verified provider processing may create or change billing records. A client purchase result is not an entitlement.
- Launch grandfathering is a separate immutable plan-id snapshot; it overrides neither the one-time course ledger nor postlaunch expired-subscription read-only rules.
- The voluntary support product is recorded in its own service-only ledger and grants no access.

## Tables

| Table | Role | Client access |
| --- | --- | --- |
| `runner_plan_unlocks` | Durable per-format/edition purchase, with provider transaction id, status and (since 2026-11-23) the charge paid. | Owner can read. |
| `runner_subscription_accounts` | Provider subscription account/status/period ledger used alongside the legacy `subscriptions` snapshot; keeps the latest charged period. | Service only. |
| `runner_billing_events` | Immutable, provider-event-id-deduplicated webhook event ledger; each charging event keeps its charge. | Service only. |
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
- The session-scoped `free` and `premium` simulations intentionally take precedence over the rollout compatibility fallback. Trusted admins can therefore exercise both states while `monetization_enabled = false`; `real` mode retains the normal legacy-open behavior until rollout.
- With monetisation enabled, anonymous users cannot create plans. Identified users must have the required planning defaults before creation.

## Sale amounts (2026-11-23)

Migration `20261123220100_record_runner_sale_amounts.sql` (additive, idempotent, RLS and grants unchanged) records what the customer really paid. Amounts are **TTC in minor units of the purchase currency** (cents for EUR; JPY-like currencies have 0 decimals and KWD-like 3, see `runner_currency_minor_factor` and `currencyMinorFactor` in `apps/web/lib/runner-payments.ts`). Every column is nullable: `null` means « not tracked », never zero.

| Table | Columns |
| --- | --- |
| `runner_billing_events` | `amount_minor`, `currency`, `store_takehome_rate`, `store_tax_rate` — the charge carried by that event (course purchase, subscription initial purchase or renewal, Stripe Checkout or `invoice.paid`). |
| `runner_plan_unlocks` | `amount_minor`, `currency`, `store_takehome_rate`, `store_tax_rate`. |
| `runner_support_purchases` | same four columns (see [runner_support_purchases](runner-support-purchases.md)). |
| `runner_subscription_accounts` | `last_amount_minor`, `last_currency`, `last_charged_at`, `last_store_takehome_rate`, `last_store_tax_rate` — latest charged period only; each period stays in `runner_billing_events`. |

Checks: amounts `>= 0`, currency `^[A-Z]{3}$`, take-home rate in [0, 1], tax rate in [0, 1). Store rates are RevenueCat's `takehome_percentage` (developer share of the price net of tax) and `tax_percentage`; they are `null` for Stripe.

Writers:

- RevenueCat webhook (`lib/revenuecat.ts`, `extractRevenueCatCharge`): only `NON_RENEWING_PURCHASE`, `INITIAL_PURCHASE` and `RENEWAL` with a positive `price_in_purchased_currency` and a currency are charges (`PRODUCT_CHANGE`, cancellations, refunds and trials record nothing). Course: the journal row carries the charge and `claim_runner_plan_unlock` copies it; when the app sync already claimed the unlock, the webhook fills it (`amount_minor=is.null` only). Subscription: the event is journaled (`transaction_status` null) then written on `revenuecat:<user>` as latest period unless an equal or newer one is stored. Support: four optional trailing parameters of `record_runner_support_event` (default null).
- Reconciliation (`syncRevenueCatSubscriptionForUser`, also the daily cron): if `GET /v1/subscribers` returns a `price` (`amount`, `currency`) for the matched non-trial subscription, it fills an account that has no amount yet, dated by its `purchase_date`; it never overwrites a webhook charge and never infers a price.
- Stripe webhook: see [Stripe Integration](../../05-integrations/stripe.md) « Runner sale amounts ».
- `claim_runner_plan_unlock` keeps its signature and rules; after a successful claim it copies the earliest journaled charge of the same provider transaction onto an unlock that has none. `record_runner_support_event` gained 4 optional trailing parameters (the 8-argument signature is dropped and recreated so that the RevenueCat named call and the positional call of `claim_runner_support_purchase` stay unambiguous); an invalid amount is ignored, never blocks the purchase, and a known amount is never overwritten.

Backfill in the migration: `runner_billing_events` from their stored payloads (RevenueCat `payload.event.price_in_purchased_currency` × currency factor, `currency`, rates; Stripe Checkout `payload.data.object.amount_total`), then `runner_plan_unlocks` from the earliest charged event of the same provider transaction. In production this gives the 5 store course unlocks recorded before 2026-11-23 (2 App Store, 3 Google Play, 9.99 EUR each) their amount. Subscriptions and support purchases recorded before had no stored payload: they stay « montant non suivi » until their next renewal webhook or a reconciliation price fills them.

The admin register shows these amounts and a store « net estimé » (TTC × (1 − tax rate) × take-home rate, only when both rates are known); see [Admin console decision](../../08-decisions/2026-11-22-admin-console.md).

## Gotchas

- Do not use `subscriptions` alone to infer a one-time course purchase; it is a global entitlement snapshot.
- Do not toggle the production rollout flag casually. Turning it off is the compatible rollback path; turning it back on must preserve the existing cohort, grandfathered-plan snapshots and billing ledgers.
- Do not move the rollout-disabled compatibility return ahead of admin simulation resolution. Doing so makes the `free` selector appear broken during pre-rollout testing.
- Do not grant table writes to mobile or browser clients, including for restore flows.
- The RevenueCat course product must be a repeat-purchasable consumable in both stores. A non-consumable supports only the first course and breaks the per-race model.
- RevenueCat webhook authorization is mandatory and fails closed when its server secret is absent. A recognized event whose database persistence fails returns a retryable non-2xx response.
- RevenueCat webhook requests may use the legacy configured Authorization value or the integration signing secret. HMAC verification uses the untouched request body, a constant-time comparison, and a five-minute timestamp tolerance.
- The protected daily reconciliation enumerates Supabase Auth UUIDs and reuses the same RevenueCat persistence path. Provider/configuration failures preserve prior access instead of being interpreted as cancellation.
- RevenueCat `NON_RENEWING_PURCHASE` events can never create Premium, even if the course-product environment is absent. Annual subscription sync requires a configured annual product or exact Premium entitlement plus a finite expiration.
- Refund reversals are idempotent: duplicates and reversal-before-purchase ordering retain an active journal state for the verified claim.

## Related Docs

- [runner_plan_unlocks](runner-plan-unlocks.md)
- [Premium Entitlement](../../03-business-rules/premium-entitlement.md)
- [RLS Policies](../rls-policies.md)

## Admin audit journal (lot 7)

`app/api/admin/runner-access-mode/route.ts` now exports its write handler through `withAdminAudit` (`apps/web/lib/admin-audit-log.ts`): each successful or server-failed call writes one best-effort line (`simulation.runner-mode`) to the admin action journal ([`admin_audit_log`](./admin-audit-log.md), shown in `/admin/system/audit`). The request and response contracts, the business rules and the schema described here are unchanged.
