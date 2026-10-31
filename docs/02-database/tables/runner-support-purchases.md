---
title: Runner Support Purchase Tables
scope: database
last_verified: 2026-10-31
ai_priority: high
related_files:
  - supabase/migrations/20261031092338_add_runner_support_purchase_ledger.sql
  - apps/mobile/lib/revenueCat.ts
  - apps/mobile/hooks/useSupportPurchase.ts
  - apps/web/lib/runner-support.ts
  - apps/web/lib/runner-support.test.ts
  - apps/web/app/api/runner/support/route.ts
  - apps/web/app/api/runner/support/route.test.ts
  - apps/web/lib/revenuecat.ts
  - supabase/tests/runner_support_purchase_checks.sql
related_tables:
  - runner_support_purchase_intents
  - runner_support_purchases
  - runner_support_events
---

# Runner support purchase tables

## Purpose

These service-only tables verify and record a voluntary, one-time “support” purchase. It is a distinct product from the per-course unlock and deliberately grants no plan, Premium, subscription, grant or cohort entitlement.

## Contract

- `runner_support_purchase_intents` serializes a pending native-store attempt per user, with a 24-hour expiry and matching provider/product transaction.
- `runner_support_purchases` allows one purchase row per user and records the current active/refunded state.
- `runner_support_events` records ordered purchase/refund/refund-reversed provider events so late events cannot overwrite a newer outcome.
- Only service role has table access; provider verification and RPC claims are server-side.
- Server authorization happens before the store sheet; admin Free/Premium simulation is blocked. Strict RevenueCat reconciliation/restore checks the same user, provider, product and transaction.
- New authorization requires an effective launch, early-supporter cohort membership and the active seven-day window. `sync`, `reconcile` and `cancel` remain available after that window solely to finish, restore or clean up an already-started purchase; they cannot begin a new charge.

## Gotchas

- Do not reuse the course-unlock SKU or ledger for support; a support purchase must never unlock a plan.
- A fresh authorization never reuses a pending intent, even on the same store: this prevents two devices from starting separate charges. A completed purchase is recovered by reconciliation; an abandoned attempt is cleared by cancellation or its 24-hour expiry.
- No real charge or production deployment is implied by this schema/code. Preview UI must not call purchase fulfillment.

## Provider preparation status

RevenueCat Android product `runner_app_support` (`prod1b302cd2ca`) is registered as a non-consumable and has no entitlement. A live Play read on 2026-10-31 returned `not_found`; actual Play Console creation remains manual because RevenueCat cannot create Android one-time Play products.

After the owner's explicit confirmation on 2026-10-31, store-state plan `76d1ffd6-4501-4131-a468-0ea3b667d603` was applied successfully. iOS product `runner_app_support` is registered as `prodcfaddbfc34`, non-consumable, with no attached entitlement. The live App Store read confirmed EUR 9.99 in FR, DE, ES, IE and IT, CHF 8 in CH and USD 8.99 in US; no automatic new territories. Apple still returned `MISSING_METADATA` / `needs_action` at the verification read. The generated review screenshot is a placeholder and must be replaced before submission; creation is not App Store review approval. No product was submitted for review, no launch activation or database migration was run, and no purchase was charged during this configuration step.

## Related Docs

- [Runner Monetization](../../03-business-rules/runner-monetization.md)
- [Runner Billing Tables](runner-billing.md)
