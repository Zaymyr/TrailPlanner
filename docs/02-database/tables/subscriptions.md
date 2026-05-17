---
title: subscriptions Table
scope: database
last_verified: 2026-05-17
ai_priority: high
related_files:
  - supabase/migrations/20250701100000_add_subscriptions_table.sql
  - supabase/migrations/20260216090000_add_plan_name_to_subscriptions.sql
  - supabase/migrations/20260405130000_add_provider_to_subscriptions.sql
  - apps/web/app/api/stripe/webhook/route.ts
  - apps/web/lib/revenuecat.ts
  - apps/web/lib/entitlements.ts
  - apps/mobile/hooks/usePremium.ts
related_tables:
  - subscriptions
  - user_profiles
  - coach_profiles
---

# `subscriptions`

## Purpose

`subscriptions` stores the active billing snapshot used by entitlement checks. It supports web Stripe subscriptions and mobile RevenueCat subscriptions in one table.

## Key Concepts

- Provider: billing source, one of `web`, `google`, or `apple`.
- Status: subscription state such as `active`, `trialing`, or `expired`.
- Price id: Stripe price id or RevenueCat product identifier depending on provider.
- Plan name: optional coach tier plan name from Stripe metadata.

## Columns

| Column | Type | Constraints/default | Purpose |
| --- | --- | --- | --- |
| `user_id` | `uuid` | primary key, references `auth.users(id)` on delete cascade | Subscription owner. |
| `stripe_customer_id` | `text` | nullable | Stripe customer id for web subscriptions. |
| `stripe_subscription_id` | `text` | nullable, indexed | Stripe subscription id. |
| `status` | `text` | nullable | Billing status. |
| `price_id` | `text` | nullable | Stripe price id or RevenueCat product id. |
| `plan_name` | `text` | nullable | Coach tier mapping name from Stripe metadata. |
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
- Stripe webhooks can also update `coach_profiles` and `user_profiles` coach status when `plan_name` maps to a coach tier.
- Mobile RevenueCat sync clears Stripe ids by writing nulls for RevenueCat providers.

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

- Product ID and active Stripe price ID are not literal repo constants; they come from `STRIPE_PRICE_ID` and Stripe dashboard metadata.
- Do not write mobile purchases into a separate entitlement table. Sync them here.
- A single primary key means a RevenueCat sync can replace the user's row; preserve intended provider behavior when changing sync code.

## Related Docs

- [Stripe](../../05-integrations/stripe.md)
- [Premium Entitlement](../../03-business-rules/premium-entitlement.md)
- [Mobile App](../../01-architecture/mobile-app.md)
- [RLS Policies](../rls-policies.md)
