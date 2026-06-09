---
title: plan_share_links Table
scope: database
last_verified: 2026-06-09
ai_priority: high
related_files:
  - supabase/migrations/20260609091933_add_plan_share_links.sql
  - apps/web/app/api/plan-shares/route.ts
  - apps/web/app/share/plan/[token]/page.tsx
  - apps/web/lib/plan-share.ts
  - apps/mobile/lib/planShareLinks.ts
  - apps/mobile/app/(app)/plan/[id]/summary.tsx
related_tables:
  - plan_share_links
  - race_plans
---

# `plan_share_links`

## Purpose

`plan_share_links` stores public crew recap snapshots for saved race plans. The table lets a runner share a web link with their support team without exposing the editable `race_plans` row or a Supabase client session.

## Key Concepts

- Public token: the random URL token sent to the crew. It is never stored in the database.
- `token_hash`: SHA-256 hex hash of the public token, used for lookup by the server page.
- Snapshot: JSONB recap payload generated from the mobile plan summary at share time.
- Owner access: authenticated users can manage only links tied to their own plan.
- Public access: anonymous viewers resolve a link through the Next.js server page, which uses service role after hashing the token.

## Columns

| Column | Type | Constraints/default | Purpose |
| --- | --- | --- | --- |
| `id` | `uuid` | primary key, default `gen_random_uuid()` | Stable share-link id. |
| `created_at` | `timestamptz` | not null, default UTC `now()` | Creation time. |
| `updated_at` | `timestamptz` | not null, trigger-maintained | Last metadata update. |
| `plan_id` | `uuid` | not null, references `race_plans(id)` on delete cascade | Shared saved plan. |
| `user_id` | `uuid` | not null, default `auth.uid()`, references `auth.users(id)` on delete cascade | Link owner. |
| `token_hash` | `text` | not null, unique, 64 lowercase hex chars | SHA-256 hash of the public URL token. |
| `snapshot` | `jsonb` | not null, max 120 KB by check constraint | Public recap payload for runner pack list and crew ravitos. |
| `snapshot_schema_version` | `integer` | not null, default `1`, constrained to `1` | Snapshot contract version. |
| `departure_time` | `text` | nullable, `HH:mm` check | Start time used for crew pass times. |
| `locale` | `text` | not null, default `fr`, constrained to `fr`/`en` | Display locale for the public page. |
| `plan_updated_at` | `timestamptz` | nullable | Source plan update timestamp when the snapshot was created. |
| `expires_at` | `timestamptz` | nullable | Optional expiry time. |
| `revoked_at` | `timestamptz` | nullable | Soft revocation time. |

## Foreign Keys

- `plan_id -> public.race_plans(id) on delete cascade`
- `user_id -> auth.users(id) on delete cascade`

Deleting a plan deletes its share links. Deleting a user deletes their share links.

## Indexes

- `plan_share_links_plan_idx` on `(plan_id, created_at desc)`
- `plan_share_links_user_idx` on `(user_id, created_at desc)`
- `plan_share_links_active_token_idx` on `token_hash` where `revoked_at is null`

## RLS Policies

See [../rls-policies.md](../rls-policies.md) for full policy context.

Summary:

- Authenticated users can select their own share links.
- Authenticated users can insert/update share links only when `user_id = auth.uid()` and the parent plan is owned by the same user.
- Authenticated users can delete their own share links.
- The table is not granted to `anon`; public link reads go through the server-rendered web page with service role.

## Business Invariants

- Store only `token_hash`; never persist the raw public token.
- The public page displays `snapshot`, not live editable planner state.
- Creating a new share link creates a new snapshot. Later plan edits do not mutate old shared snapshots unless a new link is generated.
- `snapshot_schema_version` must be bumped before storing a breaking public snapshot shape.
- `expires_at` and `revoked_at` are optional controls; the public page must ignore revoked or expired links.

## Gotchas

- Service role bypasses RLS, so `/api/plan-shares` must verify the bearer token and parent plan ownership before inserting.
- Public crew viewers do not authenticate. Do not add direct `anon` table grants unless the public access model is redesigned.
- Because only the token hash is stored, an existing link cannot be re-shown after creation; generate a new link when the runner shares again.
- The snapshot can contain product names and pass times. Treat the public URL as a secret link.

## Related Docs

- [race_plans](race-plans.md)
- [Plan Storage](../../03-business-rules/plan-storage.md)
- [RLS Policies](../rls-policies.md)
- [Web App](../../01-architecture/web-app.md)
