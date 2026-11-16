---
title: race_supporter_points
scope: database
last_verified: 2026-11-15
# Structured runner-info phase (2026-11-15): additive start-area, briefing and key-rule objects coexist with historical strings for old mobile compatibility; equipment control checkpoints and short notes are optional runner guidance.
# Structured bib phase (2026-11-15): required and third-party document kinds are optional JSON lists rendered as runner-facing guidance; historical free text remains visible as conversion source and no persisted runner checklist is introduced.
# Structured access phase (2026-11-15): optional parking and shuttle collections use geocoded locations, bounded notes and edition-day schedules; event inheritance and historical text fallbacks remain intact, while public pages expose summaries only.
# Structured station phase (2026-11-15): optional amenities, supporter access and maximum-stop metadata remain in organizer JSON; runner surfaces prefer them while preserving legacy notes, and planner pauses only warn when they exceed the organizer limit.
# Structured cutoff phase (2026-11-15): optional day offsets make overnight and multi-day aid-station/final cutoffs deterministic; missing offsets preserve the historical clock heuristic, and relay clock columns remain text normalized client-side.
ai_priority: high
related_files:
  - apps/web/lib/plan-share-race-context.ts
  - apps/mobile/app/(app)/plan/followed/[id].tsx
  - supabase/migrations/20261029091807_add_race_supporter_points.sql
  - supabase/migrations/20261029155052_fix_supporter_point_replacement_ordinality.sql
  - supabase/tests/race_supporter_points_checks.sql
  - apps/web/app/api/organizer/races/[id]/supporter-points/route.ts
  - apps/web/app/api/racebook-data/route.ts
  - apps/mobile/lib/racebook.ts
  - apps/mobile/components/racebook/RacebookSupporterPointsSection.tsx
related_tables:
  - races
  - organizer_racebook_module_settings
  - race_supporter_points
---

# race_supporter_points

Supporter Guide course line endpoints (2026-11-15): `addCourseEndpoints` opens every `formats[].stops` line with a start stop (`endpoint: "start"`, km 0, `startTimes` — wave names only when there are several SAS — and start-area directions) and closes it with the finish (`endpoint: "finish"`: the organizer « Arrivée » checkpoint is enriched, otherwise a finish stop is added) carrying `expectedArrivals`, the resolved finish cutoff and finish directions. A single wave is never labelled (no « Départ commun ») in the programme either.

Supporter Guide places (2026-11-15): the payload adds `formats[].stops`, built server-side by `buildSupporterStops` — an aid station and supporter points sharing the same normalized place name (accents, case, punctuation ignored, « St »/« Ste » = Saint/Sainte) within 2 km become one stop carrying every role (ravito, encouragement, assistance), the supporter access rule, services, cutoff and directions. Start timeline entries carry `mapsUrl` (start area directions). Both fields are additive on `schemaVersion: 1`. Supporter point rows, RLS and ordering are unchanged.

`RacebookSupporterPointsSection` now serves only the Livret supporter. It accepts optional aid stations merged into the same kilometre-ordered line (supporter-access `StatusPill`, services, resolved last-runner cutoff, maximum stop) and hides the directions action when a point has neither a Maps URL nor finite coordinates, instead of routing to 0,0.

Current mobile UI moves the published supporter-point presentation from the runner RaceBook “Où encourager” subtab into the edition Supporter Guide. The snapshot field, API serialization and legacy-app behavior are retained; organizer microcopy now names the Livret supporter as the destination.

Public supporter-point serialization continues to depend on the exact effective module state. Independent organizer invoices do not expose supporter points and do not change their existing client grants or RLS.

The shared RaceBook payload parser now accepts additive bib-pickup conditions. Supporter-point validation, GPX/address coordinate rules, ordering, publication filtering, and RLS remain unchanged.

Mobile présente maintenant le nom puis les autorisations sur deux lignes, centre ce bloc face à la distance et aux actions et localise tous les libellés visibles. Les URL, permissions, coordonnées, ordre et limites analytics restent inchangés.

Supporter points are read on mobile only from the immutable RaceBook publication payload. A missing or older publication is unavailable rather than a reason to query this draft source table directly.

## Purpose

Supporter points stay official, public RaceBook content. The organizer module is named **Suivi coureur**; the runner-facing mobile Course sub-tab is labelled **Où encourager**. Database and API identifiers keep `supporter_points`. They are not copied into a runner plan or personalized by the Livret plan reflection.

Stores organizer-authored locations where supporters may encourage a runner, provide assistance, or both. The course kilometer and the supporter access location are deliberately separate: `km` positions the runner on the course while the coordinates and Maps URL describe how a supporter reaches the location.

## Contract

| Column | Rule |
|---|---|
| `race_id` | Required format owner; deleted with the format. |
| `name` | Organizer label. Blank values are allowed only for drafts. |
| `km` | Distance from the start. A published point must be between zero and `races.distance_km`. |
| `order_index` | Server-derived order after sorting by kilometer. |
| `encouragement_allowed` / `assistance_allowed` | At least one must be true for public visibility. |
| `access_on_course` | Organizer hint that access uses the GPX coordinate at `km`; the persisted coordinates remain the public routing source of truth. |
| `access_label` | Human-readable address or access label. |
| `latitude` / `longitude` | Optional as a pair in drafts; both are required and range-checked for public visibility. |
| `google_maps_url` | Optional HTTP(S) directions URL. Mobile falls back to the coordinates when absent. |
| `access_note` | Optional free-form access instructions. |
| `plan_url` | Optional HTTP(S) link to an external access plan. |

Draft rows may be incomplete and remain visible through the authenticated organizer route. Direct client reads are restricted by RLS to complete points whose `supporter_points` module is effective. Completeness requires a non-empty name, an in-range kilometer, valid paired coordinates, and at least one permission flag.

Mobile presents permission chips inside the title/distance header, hides `access_label` only when its normalized value repeats `name`, and keeps directions plus the optional external plan as right-aligned icon actions. A distinct access label and access note remain visible beneath the header.

Authenticated followed-plan detail is a second read-only consumer of the published snapshot. It inserts visible supporter points into the assistance timeline, interpolates a plan ETA by kilometer, reapplies the latest confirmed-passage delay, distinguishes encouragement from assistance, and builds directions from the published Maps URL or coordinates. Draft rows and disabled modules are never consulted.

Mobile performs that interpolation with a client-local pure helper to respect its package boundary; the input remains the same immutable server projection.

Organizer GET responses normalize nullable editable text and URL fields to empty strings. PUT accepts both those strings and legacy `null` values, so re-saving an existing point cannot fail before the atomic RPC. Mobile keeps directions and an optional external plan as right-aligned, icon-only 44-point actions with explicit accessibility labels.

## Writes and ordering

Clients cannot insert, update, or delete rows directly. `PUT /api/organizer/races/:id/supporter-points` verifies the organizer membership and effective module, then calls the service-only `replace_race_supporter_points` function. The function locks the format, validates the complete submitted collection, preserves submitted identifiers, sorts by kilometer, preserves submitted order when kilometers are equal, assigns zero-based `order_index` values, and replaces the collection atomically. Its JSON input is enumerated with `jsonb_array_elements ... WITH ORDINALITY`, then parsed laterally; PostgreSQL does not allow the previous recordset column-definition form together with ordinality.


## Security

- `anon` and `authenticated` receive `SELECT` only; the public policy still filters incomplete or disabled rows.
- `service_role` owns all mutations and is the only role allowed to execute the replacement function.
- Organizer ownership is checked by the API before the service mutation.
- Analytics must never include addresses, coordinates, access notes, Maps URLs, or external plan URLs.

Trail signature (2026-11-09): the runner supporter-point timeline links its points with a dotted trail rail instead of a solid line. Presentation only: no query, field or directions-link change.

## Related Docs

- [Organizer RaceBook Module Settings](organizer-racebook-module-settings.md)
- [RLS Policies](../rls-policies.md)
- [Organizer Race Management](../../03-business-rules/organizer-race-management.md)

Supporter-point kilometer labels use the shared localized distance formatter. Chronology, URLs, access notes, coordinates, publication gates, and RLS remain unchanged.
