---
title: social_accounts Table
scope: database
last_verified: 2026-11-19
ai_priority: medium
related_files:
  - supabase/migrations/20261119130000_add_social_posts.sql
  - supabase/tests/social_accounts_checks.sql
  - apps/web/lib/instagram/accounts.ts
  - apps/web/lib/instagram/crypto.ts
  - apps/web/app/api/admin/instagram/route.ts
  - apps/web/app/api/admin/instagram/callback/route.ts
  - apps/web/app/api/cron/instagram-token-refresh/route.ts
related_tables:
  - social_accounts
---

# `social_accounts`

## Purpose

The connected Instagram professional account (`pace_your.self`) and its long-lived token, used by [Instagram Reels Publishing](../../05-integrations/instagram-publishing.md). One row per connected account; the most recently updated Instagram row is the one used.

## Key Concepts

- The token is encrypted by the web server (AES-256-GCM, key `SOCIAL_TOKEN_ENCRYPTION_KEY`) before it reaches the database; Supabase never stores or sees it in clear.
- The daily job refreshes it once 50 days old; a refused or expired token sets `needs_reconnect`.

## Columns

| Column | Type | Constraints/default | Purpose |
| --- | --- | --- | --- |
| `id` | `uuid` | primary key | Row id. |
| `platform` | `text` | `instagram` only | Network. |
| `ig_user_id` | `text` | 1-64 characters; unique with `platform` | Instagram professional account id (`user_id` of `/me`). |
| `username` | `text` | ≤ 64 characters | Handle shown in the admin. |
| `access_token_encrypted` | `text` | must start with `v1:` | `v1:<iv>:<tag>:<ciphertext>` (base64url). |
| `token_expires_at` | `timestamptz` | not null | Expiry of the long-lived token (60 days). |
| `token_refreshed_at` | `timestamptz` | not null | Last connection or refresh. |
| `status` | `text` | `connected`, `needs_reconnect`; default `connected` | Whether publishing can use the token. |
| `status_message` | `text` | ≤ 500 characters | Last refresh error or reconnect reason. |
| `connected_by` | `uuid` | references `auth.users(id)` on delete set null | Admin who connected the account. |
| `created_at`, `updated_at` | `timestamptz` | `updated_at` set by trigger `set_social_accounts_updated_at` | Timing. |

## Foreign Keys

- `connected_by` → `auth.users(id)` on delete set null (indexed).

## Indexes

- Unique `(platform, ig_user_id)` (upsert target of the OAuth callback).
- `social_accounts_connected_by_idx`.

## RLS Policies

RLS on, no policy, all privileges revoked from `public`, `anon` and `authenticated`, granted to `service_role` only. `supabase/tests/social_accounts_checks.sql` asserts that client roles cannot read the token column, that a clear token is rejected and that an account cannot be stored twice.

## Business Invariants

- The token column is never returned by an API: `toPublicAccount` drops it.
- Reconnecting the same account updates its row (new token, status `connected`).

## Common Queries

```sql
select username, status, token_expires_at, token_refreshed_at, status_message
from public.social_accounts where platform = 'instagram' order by updated_at desc limit 1;
```

## Gotchas

- Changing `SOCIAL_TOKEN_ENCRYPTION_KEY` makes the stored envelope undecryptable: publishing then fails with a reconnect message. Reconnect after any key rotation.
- Meta refuses to refresh a token younger than 24 h or already expired; an expired token needs a reconnect.

## Related Docs

- [social_posts](social-posts.md)
- [Instagram Reels Publishing](../../05-integrations/instagram-publishing.md)
- [RLS Policies](../rls-policies.md)
