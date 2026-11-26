// Contract of the course terrain feature (lot 2), shared by the web app, the mobile app and the
// organizer dashboard. Terrain is DISPLAY-ONLY: it never feeds pacing or nutrition until a
// calibration on several real races has been done (founder decision, 2026-11-23).
//
// Routes:
//   GET /api/race-terrain?raceId=<uuid>                → CourseTerrainResponse (public, runner-visible races)
//   GET /api/organizer/races/<raceId>/terrain          → OrganizerCourseTerrain (event organizer only)
//   PUT /api/organizer/races/<raceId>/terrain          body CourseTerrainOverridesInput → OrganizerCourseTerrain
//
// Study and real-course coverage: docs/03-business-rules/course-terrain.md.

/**
 * - `road`: paved way (asphalt, concrete…) or a road-class highway without unpaved surface.
 * - `track`: wide unpaved way (forest/farm track, gravel).
 * - `trail`: footpath / single track (OSM path, footway, bridleway; sac_scale T1–T2 or none).
 * - `technical`: demanding path (sac_scale ≥ T3, rock/scree surface, bad visibility) or organizer choice.
 * - `off_path`: no mapped way within reach of the GPX (beach, fields, cross-country) — honest "unknown".
 */
export type CourseTerrainClass = 'road' | 'track' | 'trail' | 'technical' | 'off_path';

export const COURSE_TERRAIN_CLASSES: readonly CourseTerrainClass[] = ['road', 'track', 'trail', 'technical', 'off_path'];

export type CourseTerrainSource = 'osm' | 'organizer';

export type CourseTerrainSegment = {
  /** Cumulative GPX distance, km (same axis as the GPX elevation profile). */
  fromKm: number;
  toKm: number;
  class: CourseTerrainClass;
  /** Raw OSM `surface` tag when known (e.g. `gravel`, `rock`), for tooltips only. */
  surface: string | null;
  source: CourseTerrainSource;
};

export type CourseTerrainClassShare = { km: number; pct: number };

export type CourseTerrainSummary = Record<CourseTerrainClass, CourseTerrainClassShare>;

export type CourseTerrainCoverage = {
  /** % of 25 m samples matched to a mapped way. */
  matchedPct: number;
  /** % of samples whose matched way carries a `surface` tag. */
  surfaceTagPct: number;
  /** % of samples whose matched way carries a `sac_scale` tag. */
  sacScaleTagPct: number;
};

export const COURSE_TERRAIN_ATTRIBUTION = '© OpenStreetMap contributors';
export const COURSE_TERRAIN_ATTRIBUTION_URL = 'https://www.openstreetmap.org/copyright';

export type CourseTerrain = {
  status: 'ready';
  raceId: string;
  /** Total GPX distance the segments are expressed on, km. */
  distanceKm: number;
  /** Final segments (organizer overrides applied), sorted, contiguous from 0 to distanceKm. */
  segments: CourseTerrainSegment[];
  summary: CourseTerrainSummary;
  coverage: CourseTerrainCoverage;
  hasOrganizerOverrides: boolean;
  computedAt: string;
  rulesVersion: number;
  attribution: typeof COURSE_TERRAIN_ATTRIBUTION;
  attributionUrl: typeof COURSE_TERRAIN_ATTRIBUTION_URL;
};

export type CourseTerrainPending = { status: 'pending'; raceId: string };

export type CourseTerrainUnavailableReason = 'no_route' | 'failed';

export type CourseTerrainUnavailable = { status: 'unavailable'; raceId: string; reason: CourseTerrainUnavailableReason };

export type CourseTerrainResponse = CourseTerrain | CourseTerrainPending | CourseTerrainUnavailable;

/** One organizer correction: forces a class on a km range (wins over OSM). */
export type CourseTerrainOverride = { fromKm: number; toKm: number; class: CourseTerrainClass };

export type CourseTerrainOverridesInput = { overrides: CourseTerrainOverride[] };

export const COURSE_TERRAIN_MAX_OVERRIDES = 200;

export type OrganizerCourseTerrain = {
  terrain: CourseTerrainResponse;
  /** Segments computed from OSM before overrides (empty while pending/unavailable). */
  osmSegments: CourseTerrainSegment[];
  overrides: CourseTerrainOverride[];
  /** True when the GPX changed after the overrides were saved: km positions may need a review. */
  overridesNeedReview: boolean;
};

/**
 * Display colors per class (brand palette, docs/context/PROJECT.md): same on web and mobile.
 * `off_path` is drawn hatched on top of its color so it never reads as a real surface.
 */
export const COURSE_TERRAIN_CLASS_COLORS: Record<CourseTerrainClass, string> = {
  road: '#5C6450',
  track: '#C8D44E',
  trail: '#2D5016',
  technical: '#E05252',
  off_path: '#D9D6CC',
};
