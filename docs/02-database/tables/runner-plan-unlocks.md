---
title: runner_plan_unlocks Table
scope: database
last_verified: 2026-10-30
ai_priority: high
related_files:
  - supabase/migrations/20261030121252_runner_course_access.sql
  - supabase/migrations/20261030121757_runner_purchase_processing.sql
  - apps/web/lib/runner-access.ts
related_tables:
  - race_plans
  - subscriptions
---

# `runner_plan_unlocks`

## Purpose

Stores durable one-time runner plan purchases. Subscription access remains global and is resolved separately from `subscriptions`.

## Key Concepts

- `plan_key`: stable server-derived course/edition key used to reuse one purchase when a plan is recreated.
- `provider_transaction_id`: idempotency key from Stripe or RevenueCat.
- `status`: only `active` grants editing access.

## Columns

| Column | Purpose |
| --- | --- |
| `user_id` | Owning authenticated user. |
| `plan_key` | Course/edition purchase scope. |
| `plan_id` | Optional current saved plan reference. |
| `provider` | `stripe`, `google`, `apple`, or `admin`. |
| `provider_transaction_id` | Provider event/transaction id; unique per provider. |
| `status` | `pending`, `active`, `refunded`, or `revoked`. |

## RLS Policies

Users can read their own rows. Only service role can create or change rows; client purchases must be fulfilled through verified webhooks.

## Business Invariants

- A refunded or revoked row never grants editing access.
- A plan unlock does not grant global Premium.
- Provider event retries are safe through the provider/id uniqueness constraint.
- Claims derive `race:<race-id>:edition:<edition-id|legacy>` directly from the owned plan and race; plan history is never purchase authority.
- A transaction whose latest journal state is refunded or revoked cannot be claimed, even when the refund webhook arrived first.
- Access is checked against both the canonical `plan_key` and the owned current `plan_id`; recreated plans retain a same-edition purchase.

## Gotchas

- `plan_key` must be generated from the canonical course/edition identity; do not trust a free-form browser value.
- See [Runner Billing Tables](runner-billing.md) for intents, event ledger, historical read-only access and session simulations.
