import { formatTotalElevationM, formatTotalKm, type RaceFigures } from "./race-figures";
import { SUBTITLE_LEFT_RATIO, SUBTITLE_RIGHT_RATIO, SUBTITLE_SAFE_BOTTOM_RATIO } from "./subtitle-groups";

/**
 * The reel hook: the first 2.4 s of a reel, built to stop the scroll. From frame 0 the camera is
 * already moving low over the hardest climb (video-composition), one headline figure fills the
 * upper-middle of the frame, and the short race name slides in under it at 0.5-0.9 s. No stats
 * pill, subtitle line or start detail: the regular chrome only fades in when the hook ends.
 * See docs/08-decisions/2026-11-19-reel-highlights-and-figures.md (decision « Hook »).
 */

/** Length of the hook: the first moment's caption appears right after it. */
export const HOOK_INTRO_MS = 2_400;
/** The hook sentence starts almost at once (the classic intro waits 500 ms). */
export const HOOK_NARRATION_START_MS = 250;
/** The short race name fades and slides in over this window. */
export const HOOK_NAME_IN_START_MS = 500;
export const HOOK_NAME_IN_END_MS = 900;
/** Figure and name fade out over the end of the hook while the regular chrome fades in. */
export const HOOK_FADE_OUT_MS = 350;

// --- Layout (shares of a portrait frame; cqmin = 1 % of the width at 1080 x 1920) ---
/** Same safe column as the subtitles: x from 6 % to 85 %, clear of Instagram's right band. */
export const HOOK_LEFT_RATIO = SUBTITLE_LEFT_RATIO;
export const HOOK_RIGHT_RATIO = SUBTITLE_RIGHT_RATIO;
/** Top of the figure line (share of the frame height): upper-middle, under the status area. */
export const HOOK_FIGURE_TOP_RATIO = 0.25;
export const HOOK_FIGURE_MIN_CQMIN = 14;
export const HOOK_FIGURE_MAX_CQMIN = 22;
/** The unit is set smaller than the number, on the same line. */
export const HOOK_UNIT_SCALE = 0.55;
export const HOOK_NAME_CQMIN = 6.5;
export const HOOK_NAME_LINE_HEIGHT = 1.08;
export const HOOK_NAME_MAX_LINES = 2;
export const HOOK_NAME_GAP_CQMIN = 2;
// Glyph width as a share of the font size for heavy uppercase digits (conservative estimate).
const GLYPH_WIDTH_EM = 0.62;
const WORD_GAP_EM = 0.25;

/** Lowest point of the hook text, in px of a 1080 x 1920 frame (must stay above 1500). */
export const getHookTextBottomPx = (figureCqmin = HOOK_FIGURE_MAX_CQMIN, width = 1080, height = 1920) => {
  const cqminPx = width / 100;
  return height * HOOK_FIGURE_TOP_RATIO
    + figureCqmin * cqminPx
    + HOOK_NAME_GAP_CQMIN * cqminPx
    + HOOK_NAME_MAX_LINES * HOOK_NAME_CQMIN * HOOK_NAME_LINE_HEIGHT * cqminPx;
};

export const HOOK_SAFE_BOTTOM_RATIO = SUBTITLE_SAFE_BOTTOM_RATIO;

// --- Short race name ---

const ELLIPSIS = /…/g;
const LEGAL_MARKS = /[®™©]/g;
const YEARS = /\b(?:19|20)\d{2}\b/g;
// « 10e édition », « 5ème édition », « 1re édition », « 2nde édition », « (Édition 2026) ». JS word
// boundaries ignore accented letters, so the edges are spelled out.
const ORDINAL_EDITION = /(?:^|\s)\(?\d{1,3}\s*(?:e|è|ème|eme|ième|ieme|er|ère|re|nde|nd)\.?\s+[ée]dition\)?(?=\s|$|[,.;:!?])/giu;
const YEAR_EDITION = /(?:^|\s)\(?[ée]dition\s+(?:19|20)\d{2}\)?(?=\s|$|[,.;:!?])/giu;
// Sponsor suffix: everything from « by », « powered by », « présenté(e) par » or « avec ».
const SPONSOR_SUFFIX = /\s+(?:powered\s+by|pr[ée]sent[ée]e?s?\s+par|by|avec)\s+.*$/iu;
// A trailing « - Sponsor » / « | Sponsor » segment (spaced separator: « Ultra-Trail » is kept).
const TRAILING_SEGMENT = /\s+[-–—|]\s+[^-–—|]*$/u;
const EDGE_PUNCTUATION = /^[\s\-–—|:,;./·(]+|[\s\-–—|:,;./·(]+$/gu;

const collapse = (value: string) => value
  .replace(/\(\s*\)/g, " ")
  .replace(/\s+/g, " ")
  .replace(EDGE_PUNCTUATION, "")
  .trim();

/**
 * Name shown by the hook. An explicit `race_events.short_name` wins. Otherwise the event name
 * loses its years, ® ™ ©, edition markers and sponsor suffix, spaces are collapsed and edge
 * punctuation trimmed. Never truncated and never with an ellipsis: a long name stays whole and
 * the layout wraps it on two lines.
 */
export const getReelShortName = (eventName: string, shortName?: string | null) => {
  const explicit = shortName?.replace(ELLIPSIS, "").trim();
  if (explicit) return collapse(explicit);
  const original = collapse(eventName.replace(ELLIPSIS, " ").replace(LEGAL_MARKS, ""));
  let name = eventName.replace(ELLIPSIS, " ").replace(LEGAL_MARKS, "");
  name = name.replace(ORDINAL_EDITION, " ").replace(YEAR_EDITION, " ").replace(YEARS, " ");
  const withoutSponsor = name.replace(SPONSOR_SUFFIX, "");
  if (collapse(withoutSponsor)) name = withoutSponsor;
  const withoutSegment = name.replace(TRAILING_SEGMENT, "");
  if (collapse(withoutSegment)) name = withoutSegment;
  return collapse(name) || original;
};

// --- Shock figure ---

/** From this distance the race is an ultra: its length is the headline, whatever the D+. */
export const SHOCK_ULTRA_DISTANCE_KM = 100;
/** Below it, from this D+ per km the course is clearly hilly: the D+ is the headline. */
export const SHOCK_HILLY_GAIN_PER_KM = 30;

export type ShockFigure = {
  kind: "distance" | "elevationGain";
  /** The number, formatted with the race-figures rounding policy ("5 520", "185"). */
  value: string;
  unit: "km" | "m D+";
  /** "185 km", "2 276 m D+". */
  text: string;
};

/**
 * One headline figure for the hook, from the canonical race figures (deterministic):
 * 1. 100 km or more: the distance (« 185 km »), the ultra length is what stops the scroll;
 * 2. otherwise, a known D+ of 30 m per km or more: the D+ (« 2 276 m D+ »);
 * 3. otherwise the distance (« 42 km »).
 * Null when the race has no usable figure.
 */
export const pickShockFigure = (figures: RaceFigures): ShockFigure | null => {
  const distance = figures.distanceKm > 0 ? formatTotalKm(figures.distanceKm) : null;
  const gain = formatTotalElevationM(figures);
  const gainPerKm = figures.distanceKm > 0 && figures.elevationGainM !== null ? figures.elevationGainM / figures.distanceKm : 0;
  const useGain = gain !== null && figures.elevationGainM !== null && figures.elevationGainM > 0
    && (!distance || (figures.distanceKm < SHOCK_ULTRA_DISTANCE_KM && gainPerKm >= SHOCK_HILLY_GAIN_PER_KM));
  if (useGain) return { kind: "elevationGain", value: gain, unit: "m D+", text: `${gain} m D+` };
  if (distance) return { kind: "distance", value: distance, unit: "km", text: `${distance} km` };
  return null;
};

/**
 * Font size (cqmin) of the figure's number so the whole figure holds on one line of the safe
 * column (79 cqmin wide in portrait): as large as possible up to 22 cqmin, never under 14. The
 * overlay also forbids wrapping, so a long figure shrinks instead of breaking.
 */
export const getShockFigureFontCqmin = (
  figure: Pick<ShockFigure, "value" | "unit">,
  columnCqmin = (HOOK_RIGHT_RATIO - HOOK_LEFT_RATIO) * 100,
) => {
  const widthEm = figure.value.length * GLYPH_WIDTH_EM + WORD_GAP_EM + figure.unit.length * GLYPH_WIDTH_EM * HOOK_UNIT_SCALE;
  const fitting = (columnCqmin * 0.96) / widthEm;
  return Math.max(HOOK_FIGURE_MIN_CQMIN, Math.min(HOOK_FIGURE_MAX_CQMIN, Math.floor(fitting * 10) / 10));
};

// --- Timing ---

const clamp01 = (value: number) => Math.min(1, Math.max(0, value));

export type HookOverlayState = {
  figureOpacity: number;
  nameOpacity: number;
  /** Upward slide still to do for the name (cqmin), 0 once it is in place. */
  nameOffsetCqmin: number;
  /** Opacity of the regular chrome (title band, profile): it only arrives as the hook leaves. */
  chromeOpacity: number;
};

/** Overlay of the hook at a time of the reel (ms from its start). */
export const getHookOverlayState = (timeMs: number, hookMs = HOOK_INTRO_MS): HookOverlayState => {
  const out = clamp01((hookMs - timeMs) / HOOK_FADE_OUT_MS);
  const nameIn = clamp01((timeMs - HOOK_NAME_IN_START_MS) / (HOOK_NAME_IN_END_MS - HOOK_NAME_IN_START_MS));
  const eased = nameIn * nameIn * (3 - 2 * nameIn);
  return {
    figureOpacity: timeMs < hookMs ? out : 0,
    nameOpacity: timeMs < hookMs ? Math.min(eased, out) : 0,
    nameOffsetCqmin: (1 - eased) * 3,
    chromeOpacity: timeMs < hookMs ? 1 - out : 1,
  };
};
