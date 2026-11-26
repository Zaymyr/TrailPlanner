// OSM tags -> terrain class. Display-only (docs/03-business-rules/course-terrain.md).
// Bump COURSE_TERRAIN_RULES_VERSION whenever a rule changes: rows computed with an older version
// are recomputed by the cron.

import type { CourseTerrainClass } from "@trailplanner/shared";

export const COURSE_TERRAIN_RULES_VERSION = 1;

export type OsmTags = Record<string, string | undefined>;

const PAVED = new Set([
  "asphalt", "concrete", "concrete:plates", "concrete:lanes", "paved", "paving_stones", "sett",
  "cobblestone", "unhewn_cobblestone", "metal", "wood", "bricks", "chipseal",
]);
const ROCKY = new Set(["rock", "rocks", "scree", "stone", "shingle", "boulders"]);
const ROAD_HIGHWAYS = new Set([
  "motorway", "trunk", "primary", "secondary", "tertiary", "unclassified", "residential", "living_street",
  "service", "pedestrian", "motorway_link", "trunk_link", "primary_link", "secondary_link", "tertiary_link", "road",
]);
/** sac_scale T3 and above. */
const TECHNICAL_SAC = new Set(["demanding_mountain_hiking", "alpine_hiking", "demanding_alpine_hiking", "difficult_alpine_hiking"]);
const BAD_VISIBILITY = new Set(["bad", "horrible", "no"]);

type Rule = { class: Exclude<CourseTerrainClass, "off_path">; description: string; test: (tags: OsmTags) => boolean };

const isPaved = (tags: OsmTags) => Boolean(tags.surface && PAVED.has(tags.surface));

/**
 * First matching rule wins; `trail` is the fallback. `off_path` is never derived from tags: it is
 * the class of samples with no mapped way within the match distance (see matching.ts).
 * GPX slope is deliberately NOT used (founder decision 2026-11-26).
 */
export const COURSE_TERRAIN_RULES: readonly Rule[] = [
  {
    class: "technical",
    description: "not paved AND (sac_scale >= T3 OR rock/scree-type surface OR trail_visibility bad/horrible/no)",
    test: (tags) =>
      !isPaved(tags) &&
      (TECHNICAL_SAC.has(tags.sac_scale ?? "") || ROCKY.has(tags.surface ?? "") || BAD_VISIBILITY.has(tags.trail_visibility ?? "")),
  },
  { class: "road", description: "paved surface", test: isPaved },
  { class: "road", description: "no surface tag and a road-class highway", test: (tags) => !tags.surface && ROAD_HIGHWAYS.has(tags.highway ?? "") },
  {
    class: "trail",
    description: "highway=track graded grade4/grade5",
    test: (tags) => tags.highway === "track" && (tags.tracktype === "grade4" || tags.tracktype === "grade5"),
  },
  { class: "track", description: "highway=track (grade1-3 or no tracktype)", test: (tags) => tags.highway === "track" },
  { class: "track", description: "road-class highway with an explicit unpaved surface", test: (tags) => ROAD_HIGHWAYS.has(tags.highway ?? "") },
];

export function classifyOsmWay(tags: OsmTags = {}): Exclude<CourseTerrainClass, "off_path"> {
  for (const rule of COURSE_TERRAIN_RULES) if (rule.test(tags)) return rule.class;
  return "trail";
}
