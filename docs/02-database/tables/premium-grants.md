---
title: premium_grants Table
scope: database
last_verified: 2026-06-18
ai_priority: high
related_files:
  - supabase/migrations/20260301090000_add_premium_grants.sql
  - apps/web/lib/entitlements.ts
  - apps/mobile/hooks/usePremium.ts
related_tables:
  - premium_grants
  - user_profiles
  - subscriptions
---

# `premium_grants`

## Purpose

`premium_grants` stores manual premium overrides. Entitlement code uses active grants to provide premium access even when trial/subscription state would otherwise be free.

## Key Concepts

- Grant window: `starts_at` until `ends_at` or start plus duration.
- Manual override: premium access granted outside normal billing.
- Active grant: a grant whose start/end window contains `now()`.
- Admin-managed table: users can read only their own active grants.

## Columns

| Column | Type | Constraints/default | Purpose |
| --- | --- | --- | --- |
| `id` | `uuid` | primary key, default `gen_random_uuid()` | Grant id. |
| `user_id` | `uuid` | not null, references `auth.users(id)` on delete cascade | Grant recipient. |
| `starts_at` | `timestamptz` | not null | Grant start. |
| `initial_duration_days` | `integer` | not null | Duration fallback when `ends_at` is null. |
| `reason` | `text` | not null | Human reason for the grant. |
| `ends_at` | `timestamptz` | nullable | Explicit grant end. |
| `created_by` | `uuid` | nullable, references `auth.users(id)` on delete set null | Admin/user who created the grant. |
| `created_at` | `timestamptz` | not null, default UTC `now()` | Creation time. |
| `updated_at` | `timestamptz` | not null, trigger-maintained | Last update time. |

## Foreign Keys

- `user_id -> auth.users(id) on delete cascade`
- `created_by -> auth.users(id) on delete set null`

## Indexes

- `premium_grants_user_id_idx` on `user_id`
- `premium_grants_starts_at_idx` on `starts_at`

## RLS Policies

See [../rls-policies.md](../rls-policies.md).

Summary:

- Service role or admins can manage grants.
- Users can read their own active grants.

<!-- CONFLICT: the manage policy includes a user_metadata admin check. New policies must not use user_metadata for authorization. -->

## Business Invariants

- `ends_at` overrides the computed duration when present.
- If `ends_at` is null, active logic uses `starts_at + initial_duration_days`.
- Web entitlements and mobile premium checks both consider active grants.
- A grant can elevate a user to premium even without an active subscription.

## Common Queries

Find active grants for a user:

```sql
select id, starts_at, ends_at, initial_duration_days, reason
from public.premium_grants
where user_id = '<user-id>'
  and starts_at <= now()
  and coalesce(ends_at, starts_at + (initial_duration_days || ' days')::interval) >= now();
```

Create a 30-day grant:

```sql
insert into public.premium_grants (user_id, starts_at, initial_duration_days, reason, created_by)
values ('<user-id>', now(), 30, 'manual support grant', '<admin-user-id>');
```

## Gotchas

- Do not expose full grant management to normal authenticated users.
- New admin checks should use app metadata or server-side role verification, not `user_metadata`.
- Keep mobile and web entitlement logic aligned when changing grant semantics.

## Related Docs

- [Premium Entitlement](../../03-business-rules/premium-entitlement.md)
- [RLS Policies](../rls-policies.md)
- [Subscriptions](subscriptions.md)
- [User Profiles](user-profiles.md)
