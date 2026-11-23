---
title: Course Terrain from OpenStreetMap (prototype study)
scope: business-rule
last_verified: 2026-11-24
ai_priority: medium
related_files:
  - scripts/course-terrain/compute-terrain.mjs
  - scripts/course-terrain/osm-route-to-gpx.mjs
related_tables:
  - races
---

# Course Terrain from OpenStreetMap (prototype study)

Status: prototype / study (lot 2 preparation). Nothing here is wired to production, to the planner or to the database.

## Purpose

Estimate the terrain type along a race GPX (road, wide unpaved track, trail, technical) from OpenStreetMap so a later lot can show a terrain band under the elevation profile. This document records the method, the class rules, the results of the first runs, the observed weaknesses and the recommended production design.

**Terrain must NOT change pacing** until it has been calibrated on several real races (founder decision). `pacing-algorithm.md` is unchanged; the output of this prototype is informational only.

## Key Concepts

- Sample: the GPX is parsed (`<trkpt>` lat/lon), cumulative haversine distance is computed and the track is resampled every 25 m.
- Corridor fetch: public Overpass API, sequential requests, `User-Agent: PaceYourself-terrain-prototype/0.1 (+https://pace-yourself.com)`, backoff on 429/502/504 and on HTTP 200 responses carrying a runtime-error `remark`, endpoints `overpass-api.de` then `overpass.kumi.systems`.
- Map matching: each sample goes to the nearest way segment (point-to-segment distance, local metric projection). The previous way is kept if it is within 12 m of the best candidate (continuity, avoids jumping to a crossing road). Beyond 30 m the sample is `unknown`.
- Segments: consecutive samples with the same class are merged; runs shorter than 200 m are absorbed into the longer neighbour, then equal neighbours are merged again.

## Method

1. `node scripts/course-terrain/compute-terrain.mjs <file.gpx> [--out result.json] [--save-cache f] [--from-cache f]`.
2. The track is simplified (Douglas-Peucker, 8 m) and cut into chunks whose bounding box stays below about 9 km per side; one `way["highway"](bbox);out geom tags;` request per chunk, 5 s apart; ways are de-duplicated and filtered locally by distance.
3. The polyline form `(around:R,lat,lon,lat,lon,...)` was tried first and returned empty results on the public instance, so bbox plus local filtering is used (allowed by the spec, and it is what this prototype validates).
4. Output: console summary and JSON (`segments[{fromKm,toKm,class,surface,sacScale,highway}]`, per-class km and percent, coverage).

## Class rules

First matching rule wins (also documented in the script header).

| Class | Rule |
| --- | --- |
| `technical` | not paved AND (`sac_scale` in demanding_mountain_hiking / alpine_hiking / demanding_alpine_hiking / difficult_alpine_hiking, OR `surface` in rock / scree / stone / shingle / boulders, OR `trail_visibility` in bad / horrible / no, OR `smoothness` in very_bad / horrible / very_horrible / impassable) |
| `road` | `surface` paved (asphalt, concrete, paving_stones, sett, cobblestone, metal, wood, ...) OR no `surface` and `highway` in motorway..residential, service, living_street, unclassified, pedestrian |
| `track` | `highway=track` with `tracktype` grade1-3 or none; road-type highway with an explicit unpaved surface |
| `trail` | `highway` path / footway / bridleway / steps / cycleway, track grade4-5, `sac_scale` none / T1 / T2; also the fallback |
| `unknown` | no way within 30 m |

## Results

Data: OSM Overpass, 2026-11-23/24. Percentages of distance.

Real race GPX files are not available in the repository: `supabase/demo-assets/trail-tst-*.gpx` are synthetic (linearly interpolated coordinates), and production storage must not be used. To exercise the pipeline on real geometry, `osm-route-to-gpx.mjs` rebuilds a pseudo-recorded GPX (4 m gaussian noise) from OSM route relations. These fixtures are circular for matching (the track is made of OSM ways, hence about 100% matched) but the tag coverage and the class split are real OSM information. Their length is inflated by the added noise.

| Course | km | matched | `surface` tag | `sac_scale` tag | road | track | trail | technical | unknown |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| TMB main route, first 60 km of geometry (mountain ultra, relation 9678362) | 82.0 | 100% | 57.9% | 53.9% | 18.1% | 23.8% | 54.1% | 4.0% | 0% |
| TMB variant Fenetre d'Arpette (alpine, relation 9678380) | 14.5 | 100% | 79.6% | 84.9% | 0% | 5.2% | 84.2% | 10.7% | 0% |
| Voie Verte Berges du Rhone, Lyon (mostly paved, relation 1115075) | 19.7 | 100% | 99.6% | 0% | 67.9% | 0% | 32.1% | 0% | 0% |
| demo trail-tst-18 (synthetic) | 18.4 | 35.5% | 13.5% | 0.4% | 0% | 0% | 1.4% | 0% | 89.4% (rest 9.2% absorbed) |
| demo trail-tst-42 (synthetic) | 42.6 | 29.0% | 14.8% | 0.9% | 9.5% | 5.5% | 2.1% | 0% | 82.9% |
| demo trail-tst-82 (synthetic) | 82.3 | 25.7% | 10.8% | 2.7% | 6.1% | 2.5% | 2.2% | 0% | 89.1% |

The synthetic demo tracks mostly do not follow real paths, so their low matching is expected and says nothing about OSM quality. For trail-tst-18 the class percentages do not sum to 100% because the printed values are rounded and short matched runs were absorbed into `unknown`.

## Observed weaknesses

- Tag gaps: on the TMB main route only about 58% of matched distance has `surface` and 54% has `sac_scale`; ways without `surface` default by `highway` type (a `highway=service` or `unclassified` without surface becomes `road` although it may be gravel). `sac_scale` is absent on the paved Lyon route (expected) and on most non-alpine trails.
- A `highway=path` with neither `sac_scale` nor `surface` is `trail`, never `technical`: scree or boulder fields mapped as plain paths are under-detected.
- Crossings and parallel ways: roads and paths crossing or running alongside the track can capture a sample; the continuity rule limits this, 25 m resampling plus the 200 m absorption removes most blips, but a parallel road within 30 m can still win over a long stretch.
- Switchbacks: tight zigzags are mapped coarsely, and a GPS track cutting corners can match the wrong leg; 30 m is a compromise.
- Cross-country, snow, glacier, riverbed and open-mountain sections are not ways: they appear as `unknown` and need `natural` / `landuse` / land-cover data or manual input.
- Overpass operations: the public instances returned 502 "at capacity" and timeouts repeatedly during these runs, the polyline `around` form returned empty results, and a dense-city bbox (Lyon) returned 66k ways in one request. A bbox corridor is wasteful in cities; production needs a narrower corridor query, a dedicated or self-hosted Overpass, or a regional OSM extract. The public endpoints also state they are meant for human-operated tools rather than heavy automated use.
- Fixtures are optimistic for matching; the real match rate on organizer GPX files (recorded or hand-drawn) must be measured before drawing conclusions.

## Licensing

OSM data is ODbL. Every surface showing terrain derived from it must credit "© OpenStreetMap contributors" (link to openstreetmap.org/copyright). Stored per-race terrain segments are derived data: keep the attribution and, if the derived dataset is ever shared externally, review the share-alike obligations.

## Recommended production design

1. Compute once per GPX, on import or publication, keyed by `gpx_sha256` (same key as the other GPX-derived artifacts); recompute only when the hash changes. Run it server side (job or worker), never from the client.
2. Store the result per race (`segments`, coverage, source and OSM data timestamp), versioned by rules version so the classification table can evolve without refetching.
3. Organizer correction: the organizer can override a segment's class (and add terrain for unmapped stretches); overrides win over OSM and survive recomputation while the hash is unchanged.
4. Display: a terrain band under the elevation profile with the OSM attribution; show coverage honestly (hatched `unknown`).
5. If coverage is poor (low `surface` tag share or many `unknown` stretches): complementary sources IGN BD TOPO (France, roads and paths with nature attribute) and ESA WorldCover / land cover for off-path terrain; keep OSM as the primary source.
6. Pacing: no impact until calibrated on several races (founder decision); a later lot can compare real per-class paces with the terrain classes before any coefficient is introduced.

## Gotchas

- Coverage percentages are of 25 m samples; class percentages are of merged segment length.
- Fixture-based rows are not representative of real match rates.
- Do not ship the script's Overpass usage as-is: it is a sequential prototype for the public endpoints.

## Related Docs

- [GPX Import](gpx-import.md)
- [Pacing Algorithm](pacing-algorithm.md)
