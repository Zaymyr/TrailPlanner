---
title: races Table
scope: database
last_verified: 2026-09-12
ai_priority: high
related_files:
  - supabase/migrations/20251220120000_add_race_catalog.sql
  - supabase/migrations/20260324000000_refactor_race_catalog_to_races.sql
  - supabase/migrations/20260720120000_add_race_edition_groups.sql
  - supabase/migrations/20260804152041_add_race_event_editions.sql
  - supabase/migrations/20260820135823_add_racebook_publication_control.sql
  - supabase/migrations/20260824114439_add_organizer_import_sessions_and_drafts.sql
  - supabase/migrations/20260824152859_add_relay_course_points.sql
  - supabase/migrations/20260824164101_manage_organizer_edition_visibility_and_deletion.sql
  - supabase/migrations/20260828161008_add_race_slug_redirects.sql
  - supabase/migrations/20260829080943_update_amazeaunes_2026_final_roadbook.sql
  - supabase/migrations/20260907111600_integrate_la_tourun_2026.sql
  - supabase/migrations/20260909192254_make_catalog_elevation_and_gpx_optional.sql
  - supabase/migrations/20260909192326_seed_verified_seo_races_2026_2027.sql
  - supabase/migrations/20260909200153_enrich_verified_seo_races_batch_2.sql
  - supabase/migrations/20260910061433_import_utmb_world_series_catalog_2026_2027.sql
  - supabase/migrations/20260910074418_add_normalized_race_event_geography.sql
  - supabase/migrations/20260910103118_enrich_catalog_through_may_2027.sql
  - supabase/migrations/20260910170144_separate_racebook_preview_visibility.sql
  - supabase/migrations/20260910210621_align_organizer_format_visibility_states.sql
  - supabase/migrations/20260911091935_fix_bulk_organizer_racebook_publication.sql
  - supabase/migrations/20260911110037_fix_organizer_publication_and_manual_payment_consistency.sql
  - supabase/migrations/20260911114106_expose_private_formats_in_visible_catalog.sql
  - supabase/migrations/20260911120508_fix_single_format_publication_admin_check.sql
  - supabase/migrations/20260829204139_ensure_race_event_editions_for_formats.sql
  - supabase/tests/organizer_edition_entitlements_checks.sql
  - supabase/tests/organizer_import_sessions_checks.sql
  - supabase/tests/race_slug_redirects_checks.sql
  - apps/web/app/api/organizer/events/[id]/website-import/route.ts
  - apps/web/app/api/organizer/editions/[id]/route.ts
  - apps/web/lib/public-races.ts
  - apps/web/lib/public-race-detail.ts
  - apps/web/lib/public-race-detail.test.ts
  - scripts/audit-public-race-slugs.mjs
  - scripts/audit-public-race-slugs.test.mjs
related_tables:
  - races
  - race_events
  - race_event_editions
  - organizer_import_sessions
  - race_aid_stations
  - race_relay_points
  - race_plans
  - race_slug_redirects
---

# `races`

## Purpose

`races` stores one course format, including its catalog identity, yearly edition membership, course metrics, GPX metadata, Organizer details, and independent Racebook publication state.

## Key Concepts

- Format row: one distance/course under a parent `race_events` event.
- Edition membership: `edition_id` identifies the yearly event edition; `edition_group_id` groups the same format across years.
- Catalog visibility: `is_live` and `is_public` retain the published course/RaceBook state. Organizer-private formats deliberately keep `is_live = false`, but a preview-selected row under a visible event/edition remains discoverable by runners for plan creation.
- Organizer visibility is a three-state contract: masked = course/preview/RaceBook false, private = course false/preview true/RaceBook false, and public = all three true. Public publication requires an active paid or complimentary edition offer.
- Import completeness: `data_status` and `missing_required_fields` distinguish incomplete formats from real zero values.

## Columns

The table originates as `race_catalog`; later migrations rename and extend it. Important current groups are:

| Columns | Type | Purpose |
| --- | --- | --- |
| `id`, `slug`, `name` | `uuid`, `text`, `text` | Stable id, unique catalog slug, and display name; import RPCs cap names at 300 characters. |
| `event_id`, `edition_id`, `edition_group_id`, `series_name`, `race_date` | ids/text/date-like | Event, yearly edition, cross-year format series, and format date. |
| `distance_km`, `elevation_gain_m`, `elevation_loss_m` | `numeric` | Course metrics; distance is required for a complete catalog row, while D+ is nullable when the official source has not published it. |
| `location_text`, `external_site_url`, `thumbnail_url` | nullable text | Format location and official presentation sources. |
| `gpx_path`, `gpx_hash` | nullable text | Legacy GPX compatibility fields; null is valid when no verified trace is available. |
| `gpx_storage_path`, `gpx_sha256` | nullable text | Actual private Storage object and digest; null means no imported GPX. |
| altitude/start/bounds columns | nullable numeric | GPX-derived geographic summary. |
| `organizer_details` | nullable `jsonb` | Progressive format schedule, logistics, equipment override, and notes. |
| `is_live`, `is_public` | boolean | Course catalog state. |
| `racebook_preview_is_visible` | boolean | Mobile course-catalog inclusion for a non-live organizer format and organizer RaceBook preview selection; false masks it and excludes it from edition publication. |
| `racebook_is_live`, approval columns | boolean/timestamps/FK | Runner Racebook state and trusted approval provenance. |
| `participation_mode` | nullable text | `solo`, `relay`, or `solo_and_relay`; null means an unconfirmed historical format. |
| `data_status` | `text` | `draft` or `complete`; existing rows default to `complete`. |
| `missing_required_fields` | `text[]` | Subset of `race_date`, `location`, `distance_km`, and `source_url`. |

## Foreign Keys

- `event_id -> race_events(id)` is expected by current code; its original migration is not visible.
- `edition_id -> race_event_editions(id) on delete cascade`
- `created_by -> auth.users(id)` for private/user-created races.
- `racebook_publication_approved_by -> auth.users(id) on delete set null`
- Child source stations reference `races(id)` with cascade delete.
- Child relay points reference `races(id)` with cascade delete.
- Saved plans reference `races(id)` with `on delete set null`.
- Former public slugs reference `races(id)` from `race_slug_redirects` with cascade delete.

## Indexes

Important visible indexes cover slug uniqueness, catalog flags, edition membership, `(event_id, edition_group_id, race_date desc)`, and child station ordering.

## RLS Policies

Existing `races` policies control the whole row, including import status. Organizer import writes use service-role-only `SECURITY INVOKER` RPCs after the trusted server route verifies the admin/session scope. No direct client grant is added for draft fields.

## Business Invariants

- `data_status = complete` requires an empty `missing_required_fields` array.
- A draft cannot have `is_live` or `racebook_is_live` enabled.
- A runner-live RaceBook must also be selected for organizer preview. Turning preview off atomically clears `racebook_is_live`; turning it back on never publishes by itself.
- The service-only format publication function locks one row, authorizes either an active parent-event organizer or a trusted Auth `raw_app_meta_data` admin, and atomically restores `is_live`, `racebook_preview_is_visible`, and `racebook_is_live`; the admin lookup is isolated behind a private boolean-only helper because `service_role` cannot select `auth.users` directly. Its false branch produces the private state, while the route writes the masked state directly in one update. The edition publication function performs the same public transition for every selected complete public-source format and must not require `is_live` before that update.
- Complete catalog formats require a name, slug, exact date, location, positive distance and official source. D+ and GPX are optional enrichments and remain null when unknown.
- Unknown imported distance uses zero only while `distance_km` is listed missing; an explicitly known flat D+ may be zero, while an unknown D+ is null.
- A confirmed new import format inherits the edition start date, keeps absent GPX and D+ values null, and remains a hidden draft while any catalog-minimum value (date, location, positive distance, or source) is missing.
- A grounded named format from an event/format/regulation source can be confirmed even when its other claims are missing. Additional registration, results/archive, other, or unusable URLs cannot create the row.
- Completing an imported draft leaves `is_live = false`, leaves `is_public` unchanged, and keeps the organizer-preview flag true; completion makes the format eligible for an explicit Public transition.
- The Organizer format PATCH route and GPX upload route recompute these markers too, so a draft completed outside the import review cannot remain stuck on sentinel values.
- Racebook publication remains a separate reviewed action even when course data becomes complete.
- A hidden parent edition forces both `is_live` and `racebook_is_live` false. Re-showing it never republishes formats automatically; each complete format remains private until an explicit Public transition.
- Deleting an edition deletes its format rows; saved plans survive through their separate `race_id on delete set null` relationship.
- Relay legs are derived from start, ordered relay points, and finish; they are not separate race rows.
- A slug change atomically reserves the old value in `race_slug_redirects`; inserts and updates cannot reuse a reserved former slug.
- Final-roadbook data corrections may update confirmed dates and organizer JSON without replacing more precise existing metrics when the source only gives rounded format labels. The Les Amaz’Eaunes 2026 migration therefore preserves stored distance and elevation values and does not create unspecified ravito rows.
- Source-backed event integrations may mix complete and incomplete formats. Legacy rows retain their current publication state until a targeted catalog-field update or backfill; new writes use date, location, positive distance, and source as the publication minimum. D+ and GPX remain optional enrichment, and unsituated ravitailments remain descriptive text rather than invented station rows.
- The September 2026 curated SEO seed publishes 20 upcoming formats backed by organiser pages and enriches the 5 existing Grand Raid formats without replacing their more precise GPX-derived metrics. Candidate formats without a verified exact date, distance, location and source stay out of the public catalog.
- The second September 2026 curated batch publishes 12 additional November-to-February formats from official organiser pages, corrects the Foulée des Ducs 45 km as a relay, and adds official provenance to 6 existing Nice UTMB and Terres de Saône formats without replacing their GPX-derived metrics.
- The official UTMB World Series import publishes 268 upcoming formats across 55 official events. Stable UTMB race ids prevent shared race-page URLs from collapsing sibling formats; existing matched rows retain their GPX-derived distance/elevation values, while new formats use the official API metrics and may legitimately have no GPX.
- The organizer-source March–May 2027 batch publishes 15 additional formats across Rouffach, Cahors, and Volvic. Exact dates, locations, distances, and source URLs come from organizer pages; D+ stays null for Volvic formats whose 2027 elevation is not yet published. The existing 2026 XGTV format retains its measured metrics and receives only its verified route label/source fallback.
- The normalized-geography migration refreshes eleven Search Console-priority `location`/`location_text` labels with source-backed city, route endpoint and administrative-area wording. Exact region/department filters belong to the parent `race_events` normalized fields rather than parsed format text.
- Every dated row with an `event_id` is attached to the matching canonical event/year edition. The assignment trigger atomically creates or expands that edition when legacy catalog/import code omits `edition_id`.
- Public SEO detail reads revalidate `is_live = true` and `is_public = true` with service credentials before reading `organizer_details`, ravitos, or private `gpx_storage_path`. An attached event and edition must also remain visible. RaceBook practical fields additionally require `racebook_is_live` and an effective module under the active edition tier; uncovered draft subtrees are replaced by empty public values.
- RaceBook branding is resolved from the format's `edition_id`, not stored on `races`; changing or publishing the edition identity never changes catalog or Racebook visibility columns.

## Common Queries

Find incomplete formats for an edition:

```sql
select id, name, missing_required_fields
from public.races
where edition_id = :edition_id
  and data_status = 'draft'
order by name;
```

Select publishable course formats:

```sql
select id, name, distance_km, elevation_gain_m
from public.races
where is_live = true
  and is_public = true
  and data_status = 'complete';
```

## Gotchas

- A format's public state consumes the edition entitlement regardless of whether its origin is Admin, Offert, Stripe, or virement; changing origin does not directly rewrite format visibility.

- Do not replace an unknown D+ or absent GPX with a fabricated zero or placeholder.
- New rows without a GPX keep `gpx_path`, `gpx_hash`, and `gpx_storage_path` null. Historical placeholders are cleared by the catalog-contract migration when no stored object exists.
- Public RaceBook snapshots and profile responses are tagged by race, edition, and event. Race metadata, image, GPX, visibility, and structured-content writes invalidate the narrowest applicable tag after success.
- A declarative complete-row check is intentionally deferred until legacy catalog rows have been backfilled. The column-scoped completeness trigger protects new and catalog-relevant writes without blocking unrelated updates to legacy rows.
- Do not set a draft live. The database constraint rejects both course and Racebook visibility.
- Organizer membership may author selected module subtrees above the current tier. Never use the public/effective entitlement helper to discard those incoming private drafts.
- Do not use `edition_group_id` as yearly edition membership; use `edition_id`.
- Do not derive Racebook visibility from catalog completion or `is_live`.
- Do not reintroduce `on delete set null` for `edition_id`; confirmed edition deletion must not leave organizer formats detached from every canonical year.
- Do not infer relay participation from ravitos; use `participation_mode` and `race_relay_points`.
- Do not bulk-update slugs without reviewing the read-only audit and using the service-only rename RPC after its migration is deployed.
- Never expose `gpx_storage_path` or raw `organizer_details` from a public client contract. The public route may receive only the server-parsed, bounded GPX preview and allowlisted practical fields.
- Do not add per-format logo/color columns to `races`; all formats in one canonical edition deliberately share the branding projection.
- Do not parse `location_text` into geographic filters. It may describe a start-to-finish route crossing several communes; use the parent event's normalized geography for broad catalog filters.

## Related Docs

- [organizer_import_sessions](organizer-import-sessions.md)
- [race_events](race-events.md)
- [race_event_editions](race-event-editions.md)
- [race_aid_stations](race-aid-stations.md)
- [race_relay_points](race-relay-points.md)
- [race_slug_redirects](race-slug-redirects.md)
- [Schema Overview](../schema-overview.md)
