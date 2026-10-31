---
title: runner_launch_grandfathered_plans Table
scope: database
last_verified: 2026-10-31
ai_priority: high
related_files:
  - supabase/migrations/20261031092049_add_runner_launch_grandfathering.sql
  - supabase/tests/runner_launch_checks.sql
  - apps/web/lib/runner-access.ts
related_tables:
  - runner_launch_grandfathered_plans
  - race_plans
---

# `runner_launch_grandfathered_plans`

## Purpose

Records the immutable launch-time snapshot of saved plan ids that remain permanently readable and editable without a purchase. It applies only when the service-only launch activation is deliberately executed; the migration itself does not activate production.

## Contract

- `plan_id` is the primary key and references the existing saved plan.
- `user_id` identifies its owner and `grandfathered_at` records the single activation instant.
- The snapshot captures every plan id existing at the locked activation boundary, including an anonymous plan later transferred through account conversion. Plans created after launch use normal monetisation access.
- Owner reads are allowed; only service role can write. Client code cannot create a grandfathered entitlement.

## Gotchas

- Do not conflate this permanent prelaunch-plan access with later subscription/trial historical read-only access; postlaunch subscription expiry remains read-only unless another entitlement applies.
- Do not run the activation function or set production rollout flags merely to preview the announcement.

## Related Docs

- [Runner Monetization](../../03-business-rules/runner-monetization.md)
- [Runner Billing Tables](runner-billing.md)
