---
title: race_event_claims Table
scope: database
last_verified: 2026-08-24
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
  - apps/web/app/organizer/_components/dashboard/address-autocomplete-field.tsx
  - apps/web/app/organizer/_components/dashboard/event-format-editors.tsx
  - apps/web/app/organizer/_components/dashboard/detail-editors.tsx
  - apps/web/app/organizer/_components/dashboard/aid-stations-editor.tsx
  - apps/web/app/organizer/_components/dashboard/utf8-copy.test.ts
  - apps/web/app/organizer/_components/dashboard/website-import-review-details.tsx
  - apps/web/app/organizer/_components/dashboard/products-editor.tsx
  - apps/web/app/api/organizer/events/[id]/updates/route.ts
related_tables:
  - race_event_claims
  - race_event_editions
  - race_event_organizers
  - race_events
---

# `race_event_claims`

## Purpose

`race_event_claims` stores legacy organizer requests to manage a `race_events` row. A claim does not grant access by itself; access starts only after an admin approves it and creates a `race_event_organizers` membership. New `/organizers` creation bypasses claims and creates a draft event, its initial canonical edition range, and an owner membership directly.

## Key Concepts

- Claim: user-submitted request for one event.
- Legacy manual event claim: the previous claim route could create `race_events.is_live = false` first, then insert the claim with that new `event_id`.
- Reviewer: admin user that approves or rejects the request.
- Status: `pending`, `approved`, or `rejected`.
- Membership handoff: approved claims are linked to `race_event_organizers`.
- Direct admin delegation: an admin can create an organizer membership for an existing Auth account without creating or approving a claim.
- Edition age: once membership is active, past and future editions share the same organizer edit authorization; claims do not impose a date cutoff.

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
- Claims are retained for historical audit and existing admin workflows, but the current organizer onboarding UI does not create new claims or allow taking control of an existing catalog event.
- One user cannot keep multiple pending/approved claims for the same event.
- Manual claims still require a non-null `event_id`; the draft event row is created before the pending claim.
- Admin approval should create or reactivate a matching `race_event_organizers` row.
- Approved claims should leave the admin pending-review queue once that membership handoff succeeds; the admin tab shows those rows only through the active-access membership list.
- The admin review queue should resolve organizer identity when possible (`user_profiles.full_name`, otherwise auth email, otherwise `user_id`) so reviewers are not triaging UUIDs alone.
- Once membership exists, yearly editions may be created directly as drafts, either empty or by cloning the selected edition. Claims remain only an access-control exception for pre-existing catalog events; publication review is separate.
- The organizer dashboard is available only after membership handoff for legacy claims. Membership unlocks event, format, image, GPX, ravito, product, edition visibility/deletion, geocoded-location maintenance, and the event-level list of bib-pickup locations with their dated time slots, while first Racebook publication remains a separate admin-reviewed request carrying the clicked `race_id`. Before approval, the per-format switch requests publication; afterward it can publish or hide that Racebook. Hiding an edition forces all of its format and Racebook flags off; deleting it requires retyping the year and cannot remove the last edition. The switch waits for a save only when its own format is currently being edited, so another incomplete draft does not block it.
- Trusted admins do not need claim or membership handoff: the claims dashboard endpoint returns all events as selector entries after its `app_metadata` admin check, while preserving membership-only selector data for ordinary users.
- The same approved-only dashboard also owns the manual `Notifier les coureurs` action, including its whole-event/live-format selector and confirmed deletion of recent history entries. Pending or rejected claims must not unlock organizer update history, follower counts, sends, or deletes, and a format choice never changes that membership boundary.
- The two-pass website-import review is reserved for trusted admins, independently from normal organizer membership. Its `additionalUrls` are classified official evidence sources, not claimed formats; even a grounded source classification cannot bypass admin authorization. Confirming discovered formats may atomically create hidden drafts for the selected edition; field claims, evidence, GPX status, and LLM recommendations remain review-only until the admin selects claim ids from an unexpired event/edition/session-bound signed snapshot. Neither existence confidence, completeness, signature, nor LLM confidence replaces authorization.
- Roadbook selection is preview-only. Each document may be 25 MB because it is uploaded directly to a private, owner-folder-scoped Storage location, analyzed server-side, then deleted; it does not alter this membership boundary.
- Inside that approved-only dashboard shell, the local "Avancement global" heading/helper line above the tabs is intentionally absent; the active tab should stay larger and more contrasty than inactive tabs, and desktop event tiles should fit on one row before wrapping.
- Inside that approved-only dashboard, the event equipment editor is allowed to fan out shared-item updates to every format, and a format equipment save may shrink the event-level shared subset when an item is no longer present on all races.
- Optional GPX selection during new-format creation follows the same authorization boundary: the organizer can queue the file in the approved-only dashboard, but the actual import still happens after the `races` row is created and must stay behind the organizer server routes. Replacing an existing GPX may synchronize its returned metrics into the active client form, but this presentation refresh does not replace the membership check or grant claim-based access.
- Rejection stores review metadata but does not create membership.
- Direct e-mail assignment is not a synthetic claim: it leaves this table unchanged and stores `claim_id = null` on a new delegated membership.

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

- Client-side GPX metric synchronization is presentation state only; organizer authorization must continue to come from active `race_event_organizers` membership on the server route.
- Do not treat `status = 'approved'` as the only authorization check. Organizer write access should check an active `race_event_organizers` row.
- Do not use `user_metadata` for reviewer/admin checks.
- Do not persist the synthetic admin selector entries as `race_event_organizers`; they are response-only navigation data backed by the existing server-side admin authorization exception.
- Deleting an auth user removes their claims, but public race/event data remains owned by catalog tables.
- Rejected manual claims should keep their claim audit trail; deleting the draft event would cascade-delete the claim.
- Pending claims should show request status only, not the organizer dashboard modules.
- Keep legacy access claims visually distinct from content publication requests. Claims prove management access; publication requests validate going live.
- Publication requests validate Racebook visibility, not whether the course exists in the catalog.
- Keep direct admin delegation visually and structurally distinct from legacy claims. It grants membership immediately but must not add a fabricated claim audit row.
- Keep organizer request-state copy aligned across `/organizers` and `/organizer`: pending/rejected cards are status-only French UI and must not imply edit access before membership approval.
- Keep organizer-dashboard French copy under UTF-8 regression coverage when editing route-local labels; approval-gated screens should not ship mojibake after a component rewrite.
- Do not block the admin claim queue on auxiliary enrichment reads. If edition-request loading or organizer-identity enrichment fails, or if an auth-user email is malformed, keep serving the base claim rows with contact-email or UUID fallbacks.
- Claim approval grants membership, not a bypass around edition deletion confirmation or the server-side membership check.

## Related Docs

- [race_event_organizers](race-event-organizers.md)
- [race_events](race-events.md)
- [RLS Policies](../rls-policies.md)
- [Organizer Race Management](../../03-business-rules/organizer-race-management.md)


