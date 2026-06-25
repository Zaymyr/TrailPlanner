---
title: race_event_claims Table
scope: database
last_verified: 2026-06-25
ai_priority: high
related_files:
  - supabase/migrations/20260528120000_add_organizer_portal.sql
  - apps/web/app/api/organizer/claims/route.ts
  - apps/web/app/api/organizer/claims/route.test.ts
  - apps/web/app/api/admin/organizer-claims/route.ts
  - apps/web/app/organizers/page.tsx
  - apps/web/app/organizer/page.tsx
  - apps/web/app/organizer/_components/OrganizerDashboard.tsx
  - apps/web/app/organizer/_components/dashboard/shell.tsx
  - apps/web/app/organizer/_components/dashboard/event-format-editors.tsx
  - apps/web/app/organizer/_components/dashboard/detail-editors.tsx
  - apps/web/app/organizer/_components/dashboard/aid-stations-editor.tsx
  - apps/web/app/organizer/_components/dashboard/products-editor.tsx
  - apps/web/app/organizer/_components/dashboard/runner-preview-dialog.tsx
related_tables:
  - race_event_claims
  - race_event_organizers
  - race_events
---

# `race_event_claims`

## Purpose

`race_event_claims` stores organizer requests to manage a `race_events` row. The event can already exist in the live catalog, or it can be a non-live draft row created by the organizer claim route for a missing event. A claim does not grant access by itself; access starts only after an admin approves it and creates a `race_event_organizers` membership.

## Key Concepts

- Claim: user-submitted request for one event.
- Manual event claim: a claim route submission that creates `race_events.is_live = false` first, then inserts the claim with that new `event_id`.
- Reviewer: admin user that approves or rejects the request.
- Status: `pending`, `approved`, or `rejected`.
- Membership handoff: approved claims are linked to `race_event_organizers`.

## Columns

| Column | Type | Constraints/default | Purpose |
| --- | --- | --- | --- |
| `id` | `uuid` | primary key, default `gen_random_uuid()` | Claim id. |
| `created_at` | `timestamptz` | not null, default UTC `now()` | Creation time. |
| `updated_at` | `timestamptz` | not null, trigger-maintained | Last update time. |
| `user_id` | `uuid` | not null, references `auth.users(id)` on delete cascade | User asking to claim the event. |
| `event_id` | `uuid` | not null, references `race_events(id)` on delete cascade | Event being claimed. |
| `organization_name` | `text` | not null | Organizer organization name. |
| `role_title` | `text` | not null | User role in the organization. |
| `contact_email` | `text` | not null | Contact email for verification. |
| `official_site_url` | `text` | nullable | Official site supplied by the organizer. |
| `message` | `text` | nullable | Free-form verification note. |
| `status` | `text` | not null, default `pending`, check constraint | Review status. |
| `reviewed_by` | `uuid` | nullable, references `auth.users(id)` on delete set null | Admin reviewer. |
| `reviewed_at` | `timestamptz` | nullable | Review timestamp. |
| `reviewer_notes` | `text` | nullable | Internal admin note. |

## Foreign Keys

- `user_id -> auth.users(id) on delete cascade`
- `event_id -> public.race_events(id) on delete cascade`
- `reviewed_by -> auth.users(id) on delete set null`
- Referenced by `race_event_organizers.claim_id`

## Indexes

- `race_event_claims_user_idx` on `(user_id, created_at desc)`
- `race_event_claims_event_idx` on `(event_id, status)`
- `race_event_claims_open_user_event_idx` unique on `(user_id, event_id)` where `status in ('pending', 'approved')`

## RLS Policies

See [../rls-policies.md](../rls-policies.md).

Summary:

- Authenticated users can insert pending claims for themselves.
- Users can read their own claims.
- Admins can read and update claims using trusted `app_metadata`.

## Business Invariants

- A pending claim is not authorization.
- One user cannot keep multiple pending/approved claims for the same event.
- Manual claims still require a non-null `event_id`; the draft event row is created before the pending claim.
- Admin approval should create or reactivate a matching `race_event_organizers` row.
- The organizer dashboard, including modular JSONB detail editors, event PNG upload, format GPX preview/replacement, autosave-before-navigation, and planner-style ravito cards with integrated product picker/create-product actions, is available only after the approved-claim membership handoff. Those ravito cards now also own the fixed `Départ` and `Arrivée` timing cards for the active format, keep the primary service toggles on the compact surface, and place the organizer note directly below the main info grid in the expanded panel. The top event card now summarizes progress from the event's race formats, listing each race and its completion percentage instead of showing ravito totals or an "a jour" status badge. Its route-local dashboard components render the shell, editors, ravito/product blocks, and preview, but the authorization gate remains the approved membership state; pending claims should not unlock event, format, station, image, GPX, or product edits.
- Inside that approved-only dashboard, the event equipment editor is allowed to fan out shared-item updates to every format, and a format equipment save may shrink the event-level shared subset when an item is no longer present on all races.
- Rejection stores review metadata but does not create membership.

## Common Queries

Fetch current user's claims:

```sql
select id, event_id, organization_name, status, created_at, reviewed_at
from public.race_event_claims
where user_id = auth.uid()
order by created_at desc;
```

Admin review queue:

```sql
select id, event_id, user_id, organization_name, contact_email, status, created_at
from public.race_event_claims
where status = 'pending'
order by created_at asc;
```

## Gotchas

- Do not treat `status = 'approved'` as the only authorization check. Organizer write access should check an active `race_event_organizers` row.
- Do not use `user_metadata` for reviewer/admin checks.
- Deleting an auth user removes their claims, but public race/event data remains owned by catalog tables.
- Rejected manual claims should keep their claim audit trail; deleting the draft event would cascade-delete the claim.
- Pending claims should show request status only, not the organizer dashboard modules.
- Keep organizer request-state copy aligned across `/organizers` and `/organizer`: pending/rejected cards are status-only French UI and must not imply edit access before membership approval.

## Related Docs

- [race_event_organizers](race-event-organizers.md)
- [race_events](race-events.md)
- [RLS Policies](../rls-policies.md)
- [Organizer Race Management](../../03-business-rules/organizer-race-management.md)
