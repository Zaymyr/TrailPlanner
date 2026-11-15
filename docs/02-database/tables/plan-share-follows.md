---
title: plan_share_follows Table
scope: database
last_verified: 2026-11-15
ai_priority: high
related_files:
  - supabase/migrations/20261115122801_add_plan_share_follows.sql
  - supabase/tests/plan_share_follows_checks.sql
  - apps/web/app/api/plan-share-follows/route.ts
  - apps/web/app/api/plan-share-follows/route.test.ts
  - apps/web/app/api/plan-share-follows/preview/route.ts
  - apps/web/app/api/plan-share-follows/[id]/route.ts
  - apps/web/app/api/plan-share-follows/[id]/crew-state/route.ts
  - apps/web/app/api/plan-shares/[id]/followers/route.ts
  - apps/web/app/api/plan-shares/[id]/followers/[followId]/route.ts
  - apps/web/app/api/plan-shares/[id]/revoke/route.ts
  - apps/web/lib/plan-share-follow-service.ts
  - apps/mobile/lib/followedPlans.ts
  - apps/mobile/hooks/useFollowedPlans.ts
  - apps/mobile/components/plans/FollowedPlansList.tsx
  - apps/mobile/app/(app)/plan/followed/[id].tsx
related_tables:
  - plan_share_follows
  - plan_share_links
  - user_profiles
---

# `plan_share_follows`

## Purpose

`plan_share_follows` records that an authenticated crew member follows a runner's secret plan-share link. The row stores membership and personal presentation only; the snapshot and mutable race tracking state remain on `plan_share_links`.

## Columns

| Column | Type | Rules |
| --- | --- | --- |
| `id` | `uuid` | Primary key. |
| `share_link_id` | `uuid` | Required FK to `plan_share_links`, cascade delete. |
| `follower_user_id` | `uuid` | Required FK to `auth.users`, cascade delete. |
| `nickname` | `text` | Optional, trimmed, 1 to 60 characters. |
| `created_at` / `updated_at` | `timestamptz` | UTC timestamps; updates are trigger-maintained. |
| `removed_at` | `timestamptz` | Owner removal marker; immediately cuts follower access. |
| `archived_at` | `timestamptz` | Follower-controlled presentation marker. |

The `(share_link_id, follower_user_id)` pair is unique. A database trigger rejects following one's own link.

## Access model

- `anon` has no privileges.
- `authenticated` has SELECT only. RLS lets a follower read their non-removed membership rows and lets a link owner read followers attached to their links. Membership rows contain no snapshot or tracking data.
- All inserts, updates and deletes use authenticated Next.js routes with service role after rechecking the caller.
- The follow table never exposes `snapshot` or `crew_state`; API DTOs join those fields only after validating active membership.
- Link revocation, expiry or owner removal cuts API detail reads and crew-state updates. Reusing the same active secret link can reactivate a previously removed follow row.
- Owner-facing names come from `user_profiles.full_name`; email is never returned.

## Related docs

- [plan_share_links](plan-share-links.md)
- [RLS policies](../rls-policies.md)
- [Plan storage](../../03-business-rules/plan-storage.md)
