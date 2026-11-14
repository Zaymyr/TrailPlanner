---
title: race_event_edition_partner_slots Table
scope: database
last_verified: 2026-11-11
ai_priority: high
related_files:
  - supabase/migrations/20261109140000_add_racebook_edition_partner_slots.sql
  - supabase/tests/racebook_partner_slots_checks.sql
  - apps/web/lib/racebook-partner-slots.ts
  - apps/web/lib/racebook-partner-slots.test.ts
  - apps/web/lib/racebook-partner-slot-target.ts
  - apps/web/lib/racebook-publications.ts
  - apps/web/app/api/organizer/editions/[id]/partner-slots/route.ts
  - apps/web/app/api/racebook-partner-slots/[slot]/click/route.ts
  - apps/web/app/api/racebook-partner-slots/impression/route.ts
  - apps/web/app/api/racebook-sponsors/route.ts
  - apps/web/app/organizer/_components/dashboard/partner-slots-editor.tsx
  - apps/mobile/lib/racebookSponsorPresentation.ts
  - apps/mobile/lib/racebookSponsors.ts
  - apps/mobile/components/racebook/RacebookGearSection.tsx
  - apps/mobile/components/racebook/RacebookServicesSection.tsx
related_tables:
  - race_event_edition_partner_slots
  - race_event_edition_sponsors
  - race_event_editions
  - racebook_publication_states
---

# race_event_edition_partner_slots

Partner-slot public output follows the exact effective sponsor/module access resolved by the RaceBook routes. Independent invoice rows do not change slot visibility or table access.

<!-- NEEDS REVIEW: 2026-11-09 — migration written but not yet applied to any Supabase project; verify on the dev database before relying on production behavior. -->

## Purpose

Stores the organizer choice for each RaceBook partner slot ("emplacement partenaire"). A slot is a card where Pace Yourself shows an affiliate link by default:

| `slot_key` | Runner surface | Default affiliate |
| --- | --- | --- |
| `equipment` | Matériel tab card under the mandatory gear | Decathlon |
| `lodging` | Services tab card after the organizer services | Booking.com |

With the Signature `sponsors` module, the organizer can replace a slot with one of their own edition sponsors or hide it. This is the paid "Partenaires" option of the organizer offer: base RaceBooks keep the Pace Yourself affiliate cards.

## Key Concepts

- **No row = affiliate default.** The organizer API deletes the row when the slot goes back to `affiliate`; rows only exist for `partner` or `hidden`.
- **Partner content reuses sponsors.** Name, logo and destination come from `race_event_edition_sponsors`. A sponsor used only in a slot can stay inactive (no loading/banner/contextual placement).
- **Draft then publish.** Slot changes bump every format draft revision (same trigger function as sponsors, ignoring counters/`updated_at`) and reach runners only through the next format or edition publication, frozen in the snapshot `partnerSlots` field.
- **Gating.** Editing needs the selected `sponsors` module (like sponsors). Runner-visible replacement or hiding needs the effective sponsors module, i.e. an active Signature tier; otherwise the snapshot keeps `partnerSlots: []` and every slot renders its affiliate card.

## Columns

| Column | Rules | Meaning |
| --- | --- | --- |
| `edition_id` | FK `race_event_editions`, cascade; part of PK | Edition scope shared by every format. |
| `slot_key` | `equipment` or `lodging`; part of PK | Slot identity. |
| `mode` | `affiliate`, `partner` or `hidden` | Presentation choice. |
| `sponsor_id` | required iff `mode = 'partner'` | Organizer partner; composite FK `(edition_id, sponsor_id)` to the same edition's sponsor, cascade delete. |
| `headline` | nullable trimmed text, 1–120 characters | Optional short text under the partner name. |
| `impression_count`, `click_count` | non-negative bigint | Aggregate per-slot reporting, separate from the sponsor's own counters. |
| `created_at`, `updated_at` | UTC timestamps | Audit fields. |

The migration also adds `race_event_edition_sponsors_edition_id_id_key unique (edition_id, id)` so the composite FK can enforce same-edition partners.

## RLS and Access

RLS is enabled with no client policy; `PUBLIC`, `anon` and `authenticated` have no table privileges. Only `service_role` reads and writes rows, through:

- `GET|PUT /api/organizer/editions/:id/partner-slots` — active event membership plus selected `sponsors` module; `PUT` verifies the sponsor belongs to the edition and upserts on `(edition_id, slot_key)`. The response includes `partnersOptionAvailable` (Signature available) and per-slot counters.
- `GET /api/racebook-partner-slots/:slot/click?raceId=` — resolves the **published** snapshot partner, requires the effective sponsors module, rate-limits counting by slot plus a hashed network identifier, calls `increment_racebook_partner_slot_metric`, and redirects (302) even if counting fails.
- `POST /api/racebook-partner-slots/impression` — `{ raceId, slot, viewId }`, ephemeral per-view and global guards, aggregate-only count.

`increment_racebook_partner_slot_metric(uuid, text, text)` is `SECURITY INVOKER`, empty `search_path`, service-role-only execute; it only counts a `partner` slot of a live, RaceBook-live, preview-visible format whose event is live.

## Runner Payload

`/api/racebook-sponsors` adds `partnerSlots: { equipment, lodging }`, each `{ mode: "affiliate" }`, `{ mode: "hidden" }` or `{ mode: "partner", name, logoUrl, headline, clickUrl }`. The destination URL never leaves the server; `clickUrl` is the counted redirect. Older clients ignore the field; older payloads normalize to affiliate defaults on mobile.

## Gotchas

- Do not expose `website_url` / `destinationUrl` in runner payloads; `publicSnapshot` strips it from `partnerSlots` too.
- Organizer partner presses on mobile bypass the identified `racebook action clicked` stream (like sponsor redirects); only the default affiliate presses keep `partner_decathlon` / `partner_booking` actions.
- A slot pointing to a deleted sponsor disappears (cascade) and the slot returns to its affiliate card at the next publication.
- Snapshots published before this table have no `partnerSlots`; schema parsing defaults it to `[]`, and the route code also tolerates its absence.
- The snapshot builder treats a missing table (HTTP 404) as `[]` so publication keeps working during a staggered deployment; apply the migration before relying on the option.


## Mobile presentation

`RacebookGearSection` presents mandatory gear as a stamped checklist (session-stable stamp rotation, static dotted progress trail, 44-point rows); gear-check storage and partner slots are unchanged.

## Related Docs

- [race_event_edition_sponsors](race-event-edition-sponsors.md)
- [racebook_publications](racebook-publications.md)
- [Affiliate partner links](../../05-integrations/affiliate-partner-links.md)
- [Organizer commercial offers](../../03-business-rules/organizer-commercial-offers.md)
- [RLS checklist](../../04-auth-and-security/rls-checklist.md)
