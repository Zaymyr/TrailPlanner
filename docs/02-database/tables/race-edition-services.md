---
title: race_edition_services Table
scope: database

last_verified: 2026-11-09

ai_priority: high
related_files:
  - supabase/migrations/20260907160043_add_structured_racebook_content.sql
  - supabase/migrations/20260907170842_fix_structured_racebook_rls_dependencies.sql
  - apps/web/app/api/organizer/editions/[id]/services/route.ts
  - apps/web/lib/organizer-structured-content.ts
  - apps/web/app/organizer/_components/dashboard/structured-content-editors.tsx
  - apps/web/app/organizer/_components/dashboard/structured-content-editors.test.ts
  - apps/mobile/lib/racebook.ts
  - apps/mobile/lib/fetchWithTimeout.ts
  - apps/mobile/app/(app)/race/[id]/racebook.tsx
  - apps/mobile/components/racebook/RacebookServicesSection.tsx
related_tables:
  - race_edition_services
  - race_event_editions
---

# `race_edition_services`

The shared mobile RaceBook screen now also renders additive third-party bib-pickup conditions from organizer JSON. Service categories, edition ownership, structured precedence, publication gates, and RLS remain unchanged.

The organizer service editor removes its redundant section title and uses the global autosave indicator; its local status is simply `À jour`. Adding service cards progressively and preserving historical text do not change this table contract.

The header-attached workspace switch and the full-width Livret profile chart do not change edition-service reads or actions.

Chronological cutoff resolution and plan access gating do not change edition-service reads or actions.

The race-workspace header toolbar/footer layout (lot 10) does not change edition-service reads, grouping, visibility, or actions.

The shared RaceBook identity header and finish-cutoff placement do not change edition-service reads, grouping, visibility, or actions.

Services reste l'un des cinq onglets permanents, même sans contenu. Les icônes et actions interactives utilisent désormais la palette Pace Yourself ; l'identité organisateur n'altère toujours ni les catégories, ni les URL, ni la visibilité des lignes.

RaceBook personal passage-time interpolation is client-only and does not alter this table's service contract.

> CTA scope: the RaceBook plan CTA resolves only the current runner's saved plan for the exact format; it does not read, filter, or change edition-service rows or their external links.

> Terminologie : les textes français destinés aux utilisateurs emploient **Livret coureur** et les textes anglais **Race Book**. Les identifiants techniques stables — routes, événements analytics, objets de base de données et valeurs historiques — conservent `racebook`.

## Purpose

Stores ordered, structured restaurants, accommodation, recovery and other nearby services shared by every format of an annual edition.

The owner-only plan reflection in the mobile Livret is loaded separately from this edition-scoped public services collection and does not affect its cache or visibility.

## Contract

- `service_type` is `restaurant`, `accommodation`, `recovery` or `other`.
- `name` is always required. Restaurant and accommodation rows also require an address and a complete latitude/longitude pair.
- Website and Google Maps values are URLs; phone remains display-oriented text.
- The organizer API replaces the list atomically through `replace_race_edition_services`, preserving submitted ids.
- Deleting the edition cascades to its services. Edition duplication copies the rows with new ids.

The shared web editor file also reports SAS count and earliest time to the format schedule card. That start-wave callback does not change this edition-scoped service contract.

## Access

Preview/paywall presentation and start-time display do not alter effective service-module access.

Catalog plan CTA wording and contextual workspace navigation are presentation-only. They do not alter effective service-module resolution or expose an unpublished edition service.

The Organizer section chooser lists this setting under edition-common sections, making explicit that one switch applies to every format attached to the selected canonical edition.

Service draft writes require membership plus a selected edition `services` module. Complete or Signature is required only for public/mobile visibility. Disabling or downgrading masks rows without deleting them.

Public reads follow the visible, published RaceBook edition. Authorized event organizers can preview rows. Clients cannot mutate the table directly; the service-role Organizer API checks membership and `racebook_content.manage`.

Legacy `organizer_details.services` text remains untouched. Mobile prefers structured rows per matching category and falls back to that category's legacy text only when no structured row exists. Edition accent surfaces remain decorative and do not alter service categories or content.

The structured collection travels in the immutable RaceBook publication on mobile. A missing publication makes the complete RaceBook unavailable rather than falling back to draft service rows or legacy source data.

The two-line clamp applied to bib-pickup address text is isolated from service-card rendering and does not change service addresses or links.

The RaceBook route keeps structured service normalization, distance approximation, link construction and analytics callbacks. `RacebookServicesSection` owns only the grouped mobile presentation and receives normalized rows, the separately resolved global Booking link, the resolved theme, explicit copy and URL callbacks. Decathlon is passed to `RacebookGearSection` instead. Both global links come from `partner_link_settings` through the public server contract and never become edition-service rows.

A sponsor configured for the `services` contextual placement renders after this section in the shared compact, unframed tiered-row surface. That aggregate presentation and its impression counter do not change service rows, categories, links, or visibility.

The format access override that hides saved runner information is likewise independent from edition service rows and their visibility.

The Organizer editor serializes revisioned autosaves: a response for an older revision cannot replace newer local service edits and instead queues the latest revision. Masking a format from the private demo suppresses its whole RaceBook entry without deleting edition service rows.

Published rows travel in the immutable RaceBook snapshot. A successful services replacement marks every format of the edition dirty without invalidating the current public version.

The 2026-09-14 iOS accessibility pass changes only mobile input, gesture, and motion presentation; structured service rows, links, visibility, and API/RLS contracts remain unchanged.

Services always appears directly in the five-item RaceBook contextual bottom bar so the global Booking action has a stable location. Its filled icon and color-only active state align with the global navigation. Organizer-authored rows and their contextual sponsor surface remain hidden when the effective Services module is inactive; the hero's emergency presentation, focus-time scroll reset, and header/system return remain independent.

Service-category and external-action icons now use the published accent surface/graphic variants. This changes no service field, visibility rule, or URL, and personal equipment checks remain isolated in `racebook_gear_checks`.

Confirmed Material check/uncheck analytics and the bounded per-item checked/missing snapshots carry equipment context only; they do not attach service names, addresses, links, or categories and do not mutate edition services.

Per-format GPX map/profile choices affect only the `Tracé` cards and do not change edition-scoped services or their conditional tab.

Fullscreen course visuals and tappable ravito markers do not read, reorder, or replace edition-scoped nearby services.

Format-scoped supporter directions and assistance permissions are not edition services. They are serialized from `race_supporter_points` only when that separate module is effective.

The Livret/Mon plan switch may reuse an already saved owner plan without showing the plan-creation loader. Its owner-specific hero departure/duration/pace and compact ravito passage, segment duration and cutoff warning are not service data; route-local warm state is scoped to the exact plan id and remains separate from the edition-scoped services payload and cache.

Service distance labels now use the shared localized formatter. This changes only rendering and leaves service categories, links, ordering, and edition scope intact.

Progressive plan disclosure (2026-11-09): the plan is optional in the RaceBook. Runners without an owned plan for the format see no `Livret officiel | Mon plan` switch, no `Temps prévu`/`Allure` hero metrics and an unattached hero; the only plan entry is the discreet `RacebookPlanInviteCard` at the end of the Course route/ravitos sub-tabs (hidden in guided RaceBook onboarding, for past races and when D+ is unknown). Once a plan exists, the switch (labelled `Mon plan`) and plan metrics appear and the plan keeps enriching the Livret. This is runner presentation only: it reads and writes no row of this domain.

RaceBook polish (2026-11-09): the runner hero keeps the format/event thumbnail but renders it blurred (`blurRadius` 8) under a 90% organizer-primary veil, so no artwork text is readable behind the identity, omits the default `Solo` participation label, appends a `J-N`/`Aujourd'hui` countdown to the date line (hidden after race day), and moves its expanded block up with the collapse so titles never overlap and metrics are never clipped. Runner wording was simplified (`Où encourager`, `Barrière horaire`, `Sac d'allègement`, `Nourriture`, `Relais {n}`, weather-alert and partial-route sentences). Access transport notes turn pasted URLs into labelled buttons (`Réserver ma navette` / `Ouvrir le lien`) and bib pickup addresses without an organizer maps link fall back to a Google Maps search (`lib/racebookTextLinks.ts`). Profile cumulative tiles show `—` until the runner touches the curve. This is runner presentation only: no row, contract or tracking of this domain changes.

Publication checks and partner slots (2026-11-09): pre-publication checks and the Matériel/hébergement partner slots read the built snapshot and their own table only. They do not read, write or change this domain's rows or contracts.
