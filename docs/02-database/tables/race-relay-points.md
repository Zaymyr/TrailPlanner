---
title: race_relay_points Table
scope: database

last_verified: 2026-11-11

ai_priority: high
related_files:
  - supabase/migrations/20261105082511_enrich_saintelyon_2026_formats.sql
  - supabase/migrations/20260824152859_add_relay_course_points.sql
  - apps/web/app/api/organizer/races/[id]/relay-points/route.ts
  - apps/web/app/api/organizer/races/[id]/relay-points/route.test.ts
  - supabase/migrations/20260910081049_add_atomic_organizer_course_collections.sql
  - supabase/tests/organizer_atomic_course_collections_checks.sql
  - apps/mobile/lib/racebook.ts
  - apps/mobile/lib/fetchWithTimeout.ts
  - apps/mobile/app/(app)/race/[id]/racebook.tsx
  - apps/mobile/components/racebook/RacebookStructuredCourseSections.tsx
related_tables:
  - race_relay_points
  - races
  - race_aid_stations
  - race_event_organizers
---

# `race_relay_points`

The shared mobile RaceBook screen now also reads additive bib-pickup conditions. Relay ownership, ordering, course-kilometer derivation, completeness, module visibility, and RLS remain unchanged.

The full-width Livret profile chart keeps aid-station markers only; relay rows are unchanged.

Chronological cutoff resolution reads aid-station cutoffs only; relay handover times stay independent.

Lot 10 renders Solo/Relais participation in the RaceBook-only header footer row, after the shared metrics and beside the emergency label, phone and call action. Relay rows, derived legs and the conditional `Relais` tab are unchanged.

The maximum-time header uses only the official departure and finish cutoff; it does not infer duration from relay handovers or alter relay rows and derived legs.

Relais reste un sous-onglet conditionnel de Course dans un Livret à cinq onglets permanents. Les cartes utilisent la couleur principale d'identité plutôt que l'accent réservé au tracé/ravito ; aucun point, ordre ou segment dérivé ne change.

RaceBook personal passage-time interpolation applies to official aid stations only and does not change relay-point data.

> CTA scope: the RaceBook plan CTA is runner-owned and format-scoped; it does not read, create, or alter relay points or their derived legs.

> Terminologie : les textes français destinés aux utilisateurs emploient **Livret coureur** et les textes anglais **Race Book**. Les identifiants techniques stables — routes, événements analytics, objets de base de données et valeurs historiques — conservent `racebook`.

## Purpose

Stores ordered relay handover points. This runner-facing Racebook information remains separate from nutrition and saved-plan aid stations.

Personal plan reflection does not infer a relay handover from a runner checkpoint: it only enriches official ravitos matched by their source station identity.

## Key Concepts

- A point may stand alone or reference a source `race_aid_stations` row.
- Copied `name` and `km` values form the durable relay snapshot; deleting a linked ravito only clears the optional link.
- Legs are derived from start, ordered points, and finish rather than stored as rows, then rendered only in the mobile Racebook `Course` tab's conditional `Relais` sub-tab.
- The route still derives those legs; `RacebookStructuredCourseSections` only renders the typed result and never feeds it into nutrition or persistence.
- Relay cards remain isolated from the event-level `Services` tab, flag-filtered optional content, route-local transport expansion state in `Accès`, and the single-open ravito accordion state. The image-backed identity hero may show a `Relais` participation badge, but it does not change relay rows or derived legs.

## Racebook Identity Presentation

Relay participation badges stay in the identity hero beside the course-date, location and format metrics. The expanded hero shows the emergency label and phone with the localized call action in its footer row; the compact hero keeps the call action only.

The compact runner-progress and unified sponsor loading composition is presentation-only and remains independent from relay-point reads and derived legs.

An owner's linked-plan duration, pace and departure may appear in the Livret hero, while compact personal ravito passage/segment timing is interactive; neither behavior adds relay timing, changes derived-leg boundaries, or changes the conditional `Relais` tab.

The stable post-load sponsor surface uses compact tiered rows, and contextual sponsor placements likewise remain independent from relay ordering and the conditional `Relais` sub-tab. Moving start/finish times into the Ravitos endpoint cards does not change relay-derived boundaries or times.

The two-line clamp for bib-pickup address links likewise remains independent from relay ordering, rows, and derived legs.

Disabling the format access override hides saved runner information only; it does not change relay rows or the derived `Relais` view.

The published edition accent may recolor route/profile graphics and their lightly tinted cards, while primary may recolor the active `Relais` tab. Neither value changes relay rows, ordering, semantic cutoff states, or derived-leg calculations.

Selecting the conditional `Relais` sub-tab is recorded as RaceBook product engagement with the parent race id. Relay-point payloads and persistence remain unchanged.

## Columns

| Column | Type | Purpose |
| --- | --- | --- |
| `id`, `race_id` | `uuid` | Stable id and cascade-delete parent format. |
| `race_aid_station_id` | nullable `uuid` | Optional ravito location; set null when the ravito is deleted. |
| `name`, `km` | text/numeric | Non-empty runner label and positive course position. |
| `handover_time`, `cutoff_time`, `notes` | nullable text | Optional organizer instructions. |
| `order_index`, `created_at` | integer/timestamptz | Display order and creation time. |

## RLS Policies

- Public reads require the parent race to be public, course-live, Racebook-live, and attached to a Pro edition.
- Owners, active event organizers, and trusted `app_metadata` admins can read managed rows, which lets the mobile organizer preview include relay legs before Racebook publication.
- Mutations are service-role-only; Organizer routes enforce event membership and `relay.manage` (Pro).

## Business Invariants

- The 2026 SaintéLyon relay snapshot stores six handovers at the organizer's exact cumulative leg boundaries, links each point to the same-format aid station, keeps cutoff data structured, and leaves redundant free-text notes null.
- Points are positive and strictly before the parent race distance.
- A linked ravito and every submitted existing point id must belong to the same race.
- Switching `races.participation_mode` to `solo` removes all relay points.
- The Organizer endpoint distance-sorts and replaces the ordered collection.

## Gotchas

- The scrollable preview veil is unrelated to relay-point boundaries and does not change legs or publication.

- The plan preview boundary counts only intermediate ravitos; it is not a relay-point boundary and does not alter relay publication or legs.

- Material check/uncheck analytics and bounded per-item checked/missing snapshots are independent from relay legs and handovers; they carry no relay-point fields and do not mutate this table.

- The 2026-09-14 iOS accessibility pass changes only mobile input, gesture, and motion presentation; relay-point rows, ordering, derived legs, and nutrition separation remain unchanged.
- Organizer relay replacement is a single parent-race-locked transaction. Keep race/station ownership and distance validation inside the database function so failures cannot leave a partial sequence.

- Relay writes require Signature and an active `relay` format module; public RLS masks stored points when the module is inactive or locked.

- RaceBook onboarding is presentation-only and leaves relay-point loading and the conditional Relais tab unchanged.
- Holding initial RaceBook progress for sponsor preparation does not delay, cache, or change the separate relay-point read contract.
- Published relay points travel only in the immutable RaceBook publication on mobile; an unavailable publication must not trigger a direct draft-table fallback. A successful replacement changes the draft until explicit publication.
- RaceBook tab analytics may report that the Relay view was selected, but must not emit relay notes or other organizer-authored content as analytics properties.
- Do not use organizer branding colors to reinterpret relay cutoff or warning semantics.
- Published primary surfaces may decorate relay segment cards, but handover/cutoff meaning, ordering, and warning treatment remain unchanged.
- Solo/Relais is rendered as icon-led expanded-hero metadata rather than badges and disappears with the detailed metadata when the hero compacts; emergency/social actions remain visible independently. The conditional Relais view remains a Course sub-tab and still depends on effective module visibility plus published relay points.
- Returning to Courses replaces the active RaceBook rather than exposing an earlier format; relay rows and the conditional Relais tab remain unchanged.

- A handover is not necessarily a ravito, and a ravito is not necessarily a handover.
- Do not copy relay points into `plan_aid_stations` or nutrition calculations in this first version.
- FK behavior does not synchronize copied location text or distance; the Organizer editor does so before save.

The owner-only Livret/Mon plan switch may warm an already saved plan editor only when the warm state's plan id matches the route, but it never turns a relay handover into a personalized passage or changes the `Relais` collection.

Trail signature (2026-11-09): the runner RaceBook screen adds presentation only: faint contour lines in the hero derived from the already-loaded course elevation profile (drawn only when the organizer publishes it through `gpxDisplay.showElevationProfile`) and a ridge-line divider inside the course essentials card. It reads and writes no row of this domain and changes no query, payload or analytics event.

Trail signature iteration (2026-11-11): runner presentation only. In-page RaceBook Course, Profile and plan view selectors become trail tabs, map/transport links and the catalog format RaceBook action become signpost buttons, catalog format distance/D+ read as cotes, tab-bar blazes move to the left of the selected icon, the hero contours are lightened and the elevation profile gains a decorative summit flag and iso-line echo. No query, row, payload, navigation target or analytics event changes.


## Mobile presentation

The RaceBook screen (`apps/mobile/app/(app)/race/[id]/racebook.tsx`) renders its last-minute update through `components/racebook/TapeAlertBanner` (orange/white tape strip, 44-point expand toggle) and passes the resolved start time to the plan invitation card; data loading and writes are unchanged.

The RaceBook Course tab (Tracé, Ravitos, Où encourager) uses `TrailTabs` with `stretch` + `scrollable`: tabs share the full width, the active one on a raised painted wooden plank and the others on flat bare-wood planks. The Livret / plan bib switch is 56 points high (`RACE_WORKSPACE_SWITCH_HEIGHT`).

The RaceBook Course map and profile cards open fullscreen through watch `IconAction`s (labels `racebookMapExpand` / `racebookProfileExpand`) instead of ad-hoc square buttons; behaviour unchanged.

The RaceBook weather alert renders through the same `TapeAlertBanner` as the last-minute message (replacing the former inline alert card); data unchanged.

Sheets and modals use the shared `SheetHeader` (dotted trail handle, slender blaze, title, watch close button) and collapsible groups use `AccordionSection` (km borne with a count or icon, forest trail along the open content); UI only, data and queries unchanged.

The RaceBook Course map and profile cards are drawn without the contour corner (`contours={false}`), keeping the course visuals uncluttered.

The RaceBook hero no longer draws the course contour lines behind its header (the published elevation profile is still shown in the Course tab).

RaceBook onboarding guide cards now float above the RaceBook tab bar, and the post-tour « Envie d'aller plus loin ? » offer waits until the runner has opened two other tabs; « Créer mon plan » is a trail sign on the same creation path as the Course invite. Data and events are unchanged.

The RaceBook onboarding tour only switches tabs, scrolls and highlights zones; it changes no data or visibility. Onboarding refers to the Trail TST seed ids, so they must stay stable.

## Related Docs

Masking a format from the private RaceBook demo suppresses its complete mobile RaceBook entry point without deleting relay points.

Derived relay cards now use published accent surfaces and contrast-safe accent text. This remains presentation-only and independent from the runner-owned Material checklist.

Per-format GPX map/profile choices affect only the sibling `Tracé` content and never remove relay points or the conditional `Relais` sub-tab.

Ravito point markers projected onto the route/profile represent `race_aid_stations`, not relay handovers. Fullscreen course visuals do not merge or reinterpret these two collections.

The independently loaded Booking action occupies the permanent Services tab, while Decathlon appears in Matériel. Neither action affects relay-row reads, derived legs, or the conditional Relais sub-tab.

Supporter points are neither handover points nor aid stations. They have no relay-leg semantics and remain visible only through their independent format module.


- [races](races.md)
- [race_aid_stations](race-aid-stations.md)
- [Relationships](../relationships.md)
- [Organizer Race Management](../../03-business-rules/organizer-race-management.md)

Relay distances and ranges use the shared localized one-decimal formatter in RaceBook. This is presentation-only and preserves relay ordering, leg derivation, and handover semantics.

Progressive plan disclosure (2026-11-09): the plan is optional in the RaceBook. Runners without an owned plan for the format see no `Livret officiel | Mon plan` switch, no `Temps prévu`/`Allure` hero metrics and an unattached hero; the only plan entry is the discreet `RacebookPlanInviteCard` at the end of the Course route/ravitos sub-tabs (hidden in guided RaceBook onboarding, for past races and when D+ is unknown). Once a plan exists, the switch (labelled `Mon plan`) and plan metrics appear and the plan keeps enriching the Livret. This is runner presentation only: it reads and writes no row of this domain.

RaceBook polish (2026-11-09): the runner hero keeps the format/event thumbnail but renders it blurred (`blurRadius` 24) under a 90% organizer-primary veil, so no artwork text is readable behind the identity, omits the default `Solo` participation label, appends a `J-N`/`Aujourd'hui` countdown to the date line (hidden after race day), and moves its expanded block up with the collapse so titles never overlap and metrics are never clipped. Runner wording was simplified (`Où encourager`, `Barrière horaire`, `Sac d'allègement`, `Nourriture`, `Relais {n}`, weather-alert and partial-route sentences). Access transport notes turn pasted URLs into labelled buttons (`Réserver ma navette` / `Ouvrir le lien`) and bib pickup addresses without an organizer maps link fall back to a Google Maps search (`lib/racebookTextLinks.ts`). Profile cumulative tiles show `—` until the runner touches the curve. This is runner presentation only: no row, contract or tracking of this domain changes.

Publication checks and partner slots (2026-11-09): pre-publication checks and the Matériel/hébergement partner slots read the built snapshot and their own table only. They do not read, write or change this domain's rows or contracts.
