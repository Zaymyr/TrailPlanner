---
title: subscriptions Table
scope: database
last_verified: 2026-10-31
ai_priority: high
related_files:
  - supabase/migrations/20250701100000_add_subscriptions_table.sql
  - supabase/migrations/20260216090000_add_plan_name_to_subscriptions.sql
  - supabase/migrations/20260405130000_add_provider_to_subscriptions.sql
  - supabase/migrations/20260618145940_remove_coach_features.sql
  - apps/web/app/api/stripe/webhook/route.ts
  - apps/web/lib/revenuecat.ts
  - apps/web/lib/entitlements.ts
  - apps/mobile/hooks/usePremium.ts
related_tables:
  - subscriptions
  - user_profiles
---

# `subscriptions`

## Purpose

`subscriptions` stores the active billing snapshot used by entitlement checks. It supports web Stripe subscriptions and mobile RevenueCat subscriptions in one table.

## Key Concepts

- Provider: billing source, one of `web`, `google`, or `apple`.
- Status: subscription state such as `active`, `trialing`, or `expired`.
- Price id: Stripe price id or RevenueCat product identifier depending on provider.
- Plan name: optional billing plan metadata from Stripe or provider sync.

## Columns

| Column | Type | Constraints/default | Purpose |
| --- | --- | --- | --- |
| `user_id` | `uuid` | primary key, references `auth.users(id)` on delete cascade | Subscription owner. |
| `stripe_customer_id` | `text` | nullable | Stripe customer id for web subscriptions. |
| `stripe_subscription_id` | `text` | nullable, indexed | Stripe subscription id. |
| `status` | `text` | nullable | Billing status. |
| `price_id` | `text` | nullable | Stripe price id or RevenueCat product id. |
| `plan_name` | `text` | nullable | Optional billing plan metadata. |
| `provider` | `text` | not null, default `web`, check `web|google|apple` | Billing provider. |
| `current_period_end` | `timestamptz` | nullable | Period end used for active checks. |
| `updated_at` | `timestamptz` | not null, trigger-maintained | Last sync time. |

## Foreign Keys

- `user_id -> auth.users(id) on delete cascade`

## Indexes

- `subscriptions_user_id_idx` on `user_id`
- `subscriptions_stripe_subscription_id_idx` on `stripe_subscription_id`

## RLS Policies

See [../rls-policies.md](../rls-policies.md).

Summary:

- Service role can upsert/manage rows.
- Users can read their own row.

## Business Invariants

- Web Stripe writes use provider `web`.
- RevenueCat writes use provider `google` or `apple`.
- Entitlement checks treat `active` and `trialing` as active when the period is missing or future, depending on code path.
- RevenueCat sync writes `runner_subscription_accounts` first. It updates this legacy row only when the row does not carry Stripe customer/subscription identity, so a mobile sync cannot erase an independent web subscription.
- One-time organizer edition purchases are deliberately excluded; they use `organizer_edition_payments` and `organizer_edition_entitlements`.
- Organizer Checkout Invoice ids and downloadable invoice history also remain on the organizer payment ledger; the shared webhook must not copy them into this subscription snapshot.
- Runner annual subscriptions may additionally be recorded in `runner_subscription_accounts` so provider events remain an idempotent ledger. One-time runner course purchases are never rows in this table.

## Common Queries

Read the current user's subscription:

```sql
select provider, status, price_id, plan_name, current_period_end
from public.subscriptions
where user_id = auth.uid();
```

Upsert a web Stripe customer id:

```sql
insert into public.subscriptions (user_id, stripe_customer_id, provider)
values ('<user-id>', '<customer-id>', 'web')
on conflict (user_id) do update
set stripe_customer_id = excluded.stripe_customer_id,
    provider = excluded.provider;
```

## Gotchas

- Do not write a voluntary support purchase into `subscriptions` or infer Premium from it. It has a separate verified ledger and no entitlement semantics.

- Product ID and active Stripe price ID are not literal repo constants; they come from `STRIPE_PRICE_ID` and Stripe dashboard metadata.
- Do not write mobile purchases into a separate entitlement table. Sync them here.
- A single primary key cannot represent independent providers. Preserve Stripe identity in this projection and use `runner_subscription_accounts` as the provider-scoped runner ledger.
- Never insert organizer RaceBook purchases into this runner entitlement snapshot.
- Do not store a EUR 9.99 course purchase here: it belongs to `runner_plan_unlocks` and is scoped to one canonical format/edition.
- Multiple mounted mobile screens share one subscription refresh; keep this table read inside the central Premium monitor instead of adding screen-local copies.

## Related Docs

- [Stripe](../../05-integrations/stripe.md)
- [Premium Entitlement](../../03-business-rules/premium-entitlement.md)
- [Mobile App](../../01-architecture/mobile-app.md)
- [RLS Policies](../rls-policies.md)
