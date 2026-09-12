---
title: race_event_organizers Table
scope: database
last_verified: 2026-09-12
ai_priority: high
related_files:
  - supabase/migrations/20260528120000_add_organizer_portal.sql
  - supabase/migrations/20260618160000_add_organizer_dashboard_details.sql
  - supabase/migrations/20260820135823_add_racebook_publication_control.sql
  - supabase/migrations/20260820164141_target_racebook_publication_requests.sql
  - supabase/migrations/20260910204823_add_organizer_dashboard_onboarding.sql
  - supabase/migrations/20260910210621_align_organizer_format_visibility_states.sql
  - supabase/migrations/20260911110037_fix_organizer_publication_and_manual_payment_consistency.sql
  - supabase/migrations/20260911120508_fix_single_format_publication_admin_check.sql
  - supabase/tests/organizer_dashboard_onboarding_checks.sql
  - apps/web/lib/organizer.ts
  - apps/web/lib/organizer-dashboard-details.ts
  - apps/web/app/api/admin/organizer-claims/route.ts
  - apps/web/app/api/organizer/events/route.ts
  - apps/web/app/api/organizer/events/route.test.ts
  - apps/web/app/api/organizer/events/[id]/route.ts
  - apps/web/app/api/organizer/events/[id]/route.test.ts
  - apps/web/app/api/organizer/events/[id]/onboarding/route.ts
  - apps/web/app/api/organizer/events/[id]/onboarding/route.test.ts
  - apps/web/app/api/organizer/bootstrap/route.ts
  - apps/web/app/api/organizer/invoices/route.ts
  - apps/web/app/api/organizer/invoices/[paymentId]/download/route.ts
  - apps/web/app/organizer/_components/dashboard/types.ts
  - apps/web/app/organizer/_components/dashboard/onboarding.ts
  - apps/web/app/organizer/_components/dashboard/onboarding.test.ts
  - apps/web/app/api/organizer/editions/[id]/route.ts
  - apps/web/app/api/organizer/editions/[id]/route.test.ts
  - apps/web/app/api/organizer/events/[id]/image/route.ts
  - apps/web/app/api/organizer/events/[id]/image/route.test.ts
  - apps/web/app/api/organizer/publication-requests/route.ts
  - apps/web/app/api/admin/event-publication-requests/route.ts
  - apps/web/app/api/organizer/races/route.ts
  - apps/web/app/api/organizer/races/[id]/route.ts
  - apps/web/app/api/organizer/races/[id]/route.test.ts
  - apps/web/app/api/organizer/races/[id]/image/route.ts
  - apps/web/app/api/organizer/races/[id]/image/route.test.ts
  - apps/web/app/api/organizer/races/[id]/gpx/route.ts
  - apps/web/app/api/organizer/races/[id]/gpx/route.test.ts
  - apps/web/app/api/organizer/races/[id]/aid-stations/route.ts
  - apps/web/app/api/organizer/races/[id]/aid-stations/route.test.ts
  - apps/web/app/api/organizer/races/[id]/aid-station-products/route.ts
related_tables:
  - race_event_organizers
  - race_event_editions
  - race_event_claims
  - race_event_publication_requests
  - race_events
  - races
---

# `race_event_organizers`

## Purpose

`race_event_organizers` grants organizer access to a whole `race_events` row and all of its `races` formats. This is the authorization source for organizer access, whether it came from a legacy approved claim or direct draft creation.

## Key Concepts

- Event membership: organizer access is event-scoped, not race-row ownership.
- Source edit access: active memberships authorize event, edition date range, format, GPX, aid station, organizer detail, and station-product edits through server routes.
- Revocation: `revoked_at` disables membership without deleting audit history.
- Membership provenance: `claim_id` links membership back to an approved legacy claim when available; direct creators use `claim_id = null`.
- Admin assignment: an admin may attach a Supabase Auth account by exact e-mail match. If it is absent, an explicit UI confirmation lets the server create it through a Supabase invitation before assignment; new delegated memberships use `role = 'organizer'` and `claim_id = null`.
- Public catalog preservation: claimed public races are not tied to `races.created_by`.
- Dashboard onboarding: completion is personal to one organizer/event membership rather than shared by the event or edition.

## Columns

| Column | Type | Constraints/default | Purpose |
| --- | --- | --- | --- |
| `id` | `uuid` | primary key, default `gen_random_uuid()` | Membership id. |
| `created_at` | `timestamptz` | not null, default UTC `now()` | Creation time. |
| `event_id` | `uuid` | not null, references `race_events(id)` on delete cascade | Managed event. |
| `user_id` | `uuid` | not null, references `auth.users(id)` on delete cascade | Organizer user. |
| `claim_id` | `uuid` | nullable, references `race_event_claims(id)` on delete set null | Legacy approved claim that created the membership, or null for direct creation. |
| `role` | `text` | not null, default `owner` | Event role label. |
| `created_by` | `uuid` | nullable, references `auth.users(id)` on delete set null | Admin that granted access. |
| `revoked_at` | `timestamptz` | nullable | Revocation timestamp. |
| `revoked_by` | `uuid` | nullable, references `auth.users(id)` on delete set null | Admin that revoked access. |
| `revoke_reason` | `text` | nullable | Internal revocation reason. |
| `dashboard_onboarding_completed_at` | `timestamptz` | nullable, default null | First completion or explicit skip of the Organizer dashboard guide for this membership. |

## Foreign Keys

- `event_id -> public.race_events(id) on delete cascade`
- `user_id -> auth.users(id) on delete cascade`
- `claim_id -> public.race_event_claims(id) on delete set null`
- `created_by -> auth.users(id) on delete set null`
- `revoked_by -> auth.users(id) on delete set null`

## Indexes

- `race_event_organizers_user_idx` on `user_id`
- `race_event_organizers_event_idx` on `event_id`
- `race_event_organizers_active_user_event_idx` unique on `(user_id, event_id)` where `revoked_at is null`

## RLS Policies

See [../rls-policies.md](../rls-policies.md).

Summary:

- Users can read their own organizer memberships.
- Admins can read and manage memberships using trusted `app_metadata`.
- Child organizer policies check active membership with `revoked_at is null`.

## Business Invariants

- Approved organizer writes must check an active membership for the parent event.
- A membership grants access to all formats under the event.
- The membership-gated bootstrap/event detail reads may aggregate narrow persisted ravito, SAS, podium, service, sponsor and branding summaries for completion display; this does not widen access beyond the managed event or expose editable child collections.
- A membership grants access to source ravito service flags (`water_available`, `solid_available`, `assistance_allowed`) for all formats under the event.
- A membership grants service-route access to organizer detail JSONB on the event, its formats, and its source ravitos. Event JSONB stores common defaults, the event end date, official website, Instagram and Facebook URLs, display-normalized emergency contact phone, additive geocoded location metadata, and event-level bib pickup as several locations with independent dated time slots. Valid domain links pasted without a protocol are normalized to HTTPS before persistence; invalid and non-HTTP(S) values are rejected. Race JSONB stores active-format differences or additions, including the current access-section toggles and geocoded format/access location metadata used by the organizer dashboard.
- A membership grants service-route access to upload the event PNG thumbnail, upload a format thumbnail, preview/replace format GPX files, and delete a format for every race under the event.
- That same membership also authorizes organizer edition-grouping flows on `races`: creating a brand-new format series, renaming `series_name`, duplicating a format into a new `edition_group_id`, or cloning a new yearly edition inside an existing `edition_group_id`.
- Active membership authorizes maintenance of both past and future editions; organizer mutation routes no longer apply an additional cutoff derived from `race_date`.
- Active membership also authorizes edition visibility changes and confirmed edition deletion. The route scopes the edition back to its parent event before mutating it; unlike whole-event deletion, this action is not owner-only.
- Active membership authorizes the sanitized invoice history and invoice downloads for every edition of the parent event. It does not expose Stripe identifiers or private Storage paths, and revocation blocks both list and download routes immediately.
- That same membership-gated GPX preview now drives organizer ravito cumulative D+ / D- autofill in the approved dashboard; changing a station km does not widen authorization, it only recomputes station details from the already-authorized format trace.
- New organizer-created formats default to private (`is_live = false`, `racebook_preview_is_visible = true`, `racebook_is_live = false`) so active organizers can inspect the course and RaceBook before publication.
- Admin-confirmed import formats may start as incomplete drafts. The same membership-gated race and GPX routes may complete their required-field markers later while keeping the format private until an explicit Public transition.
- A membership authorizes organizer station-product edits, including catalog-product picker attachments and organizer-scoped product creation, only for stations under the managed event.
- Claimed public races should keep `races.created_by = null` unless they were user-private races for another flow.
- Revocation should set `revoked_at` instead of deleting the row.
- Direct admin assignment grants edit access only. It does not change catalog or Racebook visibility, approval provenance, or publication-review history.
- The dashboard guide auto-opens only while this membership's completion timestamp is null. Its idempotent service route checks the active membership before stamping the first completion; replay does not clear or replace that timestamp.
- Active membership is the first branding-route gate, but the selected edition must also grant Pro `branding.manage`; trusted admins retain the existing membership bypass implemented by the shared server authorization helper.

## Common Queries

Membership-gated bootstrap and event-detail reads return each managed format's persisted `is_live`, `racebook_preview_is_visible`, and `racebook_is_live` flags so the three-state Organizer control survives event reloads. Mobile uses the same active membership to merge preview-selected private formats into that organizer's catalog only.

Check active membership for an event:

```sql
select 1
from public.race_event_organizers
where event_id = '<event-id>'
  and user_id = auth.uid()
  and revoked_at is null;
```

Fetch active organizers for an event:

```sql
select id, user_id, role, created_at
from public.race_event_organizers
where event_id = '<event-id>'
  and revoked_at is null
order by created_at asc;
```

## Gotchas

- Organizer membership and publication origin are independent. The admin may change an edition between Admin, Offert, Stripe, and virement without adding or revoking a membership; paid origins remain ledger-backed.

- Atomic Organizer RPCs are executable only by `service_role`; the calling route must still complete the normal active-membership/admin and entitlement checks before invoking them. The format-publication RPC repeats active membership or trusted Auth `raw_app_meta_data` admin authorization so an admin does not need an artificial membership row. Its admin lookup uses a private service-only boolean helper rather than granting `service_role` direct `auth.users` reads.
- The consolidated RaceBook endpoint may use service credentials only after applying the public publication/content gate or an authenticated active-organizer check. Organizer preview responses are always `private, no-store`.

- Membership is event-scoped, but commercial rights are edition-scoped. Every active member shares the selected edition's entitlement; membership alone does not unlock paid capabilities.
- Module mutation also requires the edition/format setting to be effective. Full legacy JSON saves preserve subtrees whose module is inactive or locked.

- Do not authorize organizer edits with `races.created_by`; claimed catalog races deliberately avoid user ownership.
- Do not physically delete public race/event rows when an organizer account is deleted or revoked.
- JWT admin checks must use `app_metadata`, not `user_metadata`.
- New organizer-facing fields on child source tables should continue to check active membership for the parent event.
- Organizer dashboard JSONB fields do not change the membership model; keep using active `race_event_organizers` checks instead of field-level shortcuts.
- `POST /api/organizer/events` creates an owner membership immediately after inserting a catalog-visible event. If membership insertion fails, the route deletes that newly created event.
- Common-vs-format detail splitting is an application convention, not a new authorization boundary.
- Format equipment uses a tri-state compatibility rule inside that convention: explicit `true` replaces event equipment, explicit `false` inherits it, and an absent legacy flag may infer an override from historical differences. This does not change membership authorization.
- The current organizer UI inherits event bib pickup, equipment, and access by default. Each format can explicitly enable its own full override from the module header; those overrides, access-section toggles, and ravito start/finish timing cards remain ordinary race-detail edits behind the same active event-membership check.
- Product picker UI does not grant access by itself; station-product API routes must keep checking active event membership before replacing product links.
- Event image, race image, race delete, and GPX routes are also source mutations/reads and must keep checking active event membership.
- Event PATCH/image and race PATCH/delete/image/GPX/ravito/product routes must all retain the same active membership check even though edition age no longer changes editability.
- Edition PATCH/DELETE must retain that same membership check. The browser's year retyping is a destructive-action guard, not an authorization boundary.
- Edition sponsor reads and writes use the same active parent-event membership check. Public RaceBook presentation is a separate gated server read and grants no organizer mutation authority.
- Edition branding reads and writes use that membership check plus Pro. The runner route exposes only the published snapshot and never turns public visibility into draft mutation authority.
- Membership authorizes event maintenance and entitlement-free writes to each managed format's `racebook_preview_is_visible`, but never direct catalog liveness writes. Masking a format also clears its `racebook_is_live`; selecting it again restores only private preview. The edition publication route and service-only atomic function are the sole current path that sets runner visibility, after membership/admin and active-offer checks.
- Format deletion must still preserve saved runner plans through the `race_plans.race_id` foreign-key behavior; organizer membership grants source delete access, not plan deletion rights.
- Admin access review should remain usable even when organizer-identity enrichment fails; active memberships must still be visible with fallback ids or emails.
- Supabase Auth e-mail lookup and invitation for direct assignment must remain in the admin-only server route with the service credential. Never expose the Auth Admin user list or service credential to the browser, and never invite an absent address before the admin confirms the not-found dialog.
- A newly delegated `organizer` can edit the event and its formats but cannot use the owner-only permanent event deletion action.
- Synthetic admin selector entries have no persisted onboarding timestamp and must never be inserted solely to remember a guide replay; trusted admins are excluded from automatic display.

## Related Docs

- [race_event_claims](race-event-claims.md)
- [race_events](race-events.md)
- [Relationships](../relationships.md)
- [Organizer Race Management](../../03-business-rules/organizer-race-management.md)
