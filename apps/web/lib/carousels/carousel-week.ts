import { formatNumber, formatWeekRange, formatWeekdayDayMonth, isoWeekNumber, upper } from "./carousel-format";

/**
 * « La semaine qui vient » (pure): the Monday-Sunday races of the catalog, a signpost cover with one
 * plank per event and a list grouped by day. Rules: docs/05-integrations/instagram-carousels.md.
 */

export type WeekFormat = {
  raceId: string;
  name: string;
  date: string;
  distanceKm: number;
  elevationGainM: number | null;
  participationMode: string | null;
};

export type WeekEvent = {
  eventId: string;
  name: string;
  location: string | null;
  formats: WeekFormat[];
};

export type WeekPlank = { name: string; cotes: string; side: "right" | "left" };
export type WeekTile = { km: string; dplus: string | null };
export type WeekRow = { name: string; meta: string | null; tiles: WeekTile[] };
export type WeekDay = { label: string; rows: WeekRow[] };

export type WeekSnapshot = {
  series: "week";
  range: string;
  subtitle: string;
  label: string;
  planks: WeekPlank[];
  days: WeekDay[];
  /** Events of the week not listed (cap), « + N autres courses ». */
  more: number;
  eventCount: number;
};

/** Relays, duos, teams and walks are not « courses » for this series. */
const EXCLUDED_FORMAT = /relais|relay|\bduo|team|[ée]quipe|marche|rando|walk|nordique/i;
export const COVER_PLANKS_MAX = 5;
export const LIST_EVENTS_MAX = 6;
/**
 * Slide 2 vertical layout (px): the footer card « Ta course y est ? » always keeps this safe margin
 * under it, so it never sits at the bottom edge of the post.
 */
export const WEEK_LIST_BOTTOM_MARGIN = 120;
const SLIDE_HEIGHT = 1350;
const LIST_TOP = 160; // top padding 72 + header 70 + its margin 10 + gap 8
const FOOTER_CARD_HEIGHT = 112; // two lines of 30 px text + 2 × 20 px padding
const FOOTER_GAP = 16;
const MORE_LINE_HEIGHT = 40; // « + N autres courses » line, always reserved
/** Height budget of the list (day labels and rows), measured on the rendered slide. */
export const LIST_HEIGHT_BUDGET = SLIDE_HEIGHT - WEEK_LIST_BOTTOM_MARGIN - FOOTER_CARD_HEIGHT - FOOTER_GAP - MORE_LINE_HEIGHT - LIST_TOP;
// Rendered heights (upper bounds): day label 56 + gap 8 + top margin 12; row = name line 44 + gap 10
// + padding 22 + border 2 + gap 8; one line of tiles 50 + wrap gap 8. Six tiles always fit a line.
const DAY_HEIGHT = 76;
const ROW_BASE_HEIGHT = 86;
const TILE_LINE_HEIGHT = 58;
const TILES_PER_LINE = 6;

export const isListedFormat = (format: WeekFormat) =>
  format.participationMode !== "relay"
  && !EXCLUDED_FORMAT.test(format.name)
  && Number.isFinite(format.distanceKm)
  && format.distanceKm > 0;

const addDays = (day: string, days: number) => new Date(Date.parse(`${day}T00:00:00Z`) + days * 86_400_000).toISOString().slice(0, 10);

/**
 * Events of the week, only their listed formats, ordered by priority: more formats first, then the
 * longest format, then the name and the id (deterministic).
 */
export const selectWeekEvents = (events: WeekEvent[], monday: string) => {
  const sunday = addDays(monday, 6);
  return events
    .map((event) => ({
      ...event,
      formats: event.formats
        .filter((format) => isListedFormat(format) && format.date >= monday && format.date <= sunday)
        .sort((left, right) => right.distanceKm - left.distanceKm || left.raceId.localeCompare(right.raceId)),
    }))
    .filter((event) => event.formats.length > 0)
    .sort((left, right) =>
      right.formats.length - left.formats.length
      || right.formats[0].distanceKm - left.formats[0].distanceKm
      || left.name.localeCompare(right.name, "fr")
      || left.eventId.localeCompare(right.eventId));
};

const kmText = (km: number) => formatNumber(km, km < 10 && !Number.isInteger(km) ? 1 : 0);

/** « 160 · 80 · 46 KM », « 60 KM · D+ 3 580 M » for a single format, then a short location when it fits. */
export const plankCotes = (event: WeekEvent) => {
  const distances = Array.from(new Set(event.formats.map((format) => kmText(format.distanceKm))));
  let cotes = `${distances.join(" · ")} KM`;
  const single = event.formats.length === 1 ? event.formats[0] : null;
  if (single && single.elevationGainM !== null && single.elevationGainM > 0) cotes += ` · D+ ${formatNumber(single.elevationGainM)} M`;
  const location = event.location ? upper(event.location) : null;
  if (location && location.length <= 14 && cotes.length + location.length + 3 <= 28) cotes += ` · ${location}`;
  return cotes;
};

const tileLines = (count: number) => Math.max(1, Math.ceil(count / TILES_PER_LINE));

/** Days of the listed events, chronological; within a day, rows keep the priority order. */
export const groupWeekDays = (events: WeekEvent[]): WeekDay[] => {
  const byDay = new Map<string, WeekRow[]>();
  events.forEach((event) => {
    const dates = Array.from(new Set(event.formats.map((format) => format.date))).sort();
    dates.forEach((date) => {
      const formats = event.formats.filter((format) => format.date === date);
      byDay.set(date, [...(byDay.get(date) ?? []), {
        name: event.name,
        meta: event.location ? upper(event.location) : null,
        tiles: formats.map((format) => ({
          km: `${kmText(format.distanceKm)} KM`,
          dplus: format.elevationGainM !== null && format.elevationGainM > 0 ? `D+ ${formatNumber(format.elevationGainM)} M` : null,
        })),
      }]);
    });
  });
  return Array.from(byDay.entries())
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([date, rows]) => ({ label: formatWeekdayDayMonth(date), rows }));
};

/** Estimated height of the list, to stay inside slide 2. */
export const estimateListHeight = (days: WeekDay[]) =>
  days.reduce((sum, day) => sum + DAY_HEIGHT + day.rows.reduce((rows, row) => rows + ROW_BASE_HEIGHT + tileLines(row.tiles.length) * TILE_LINE_HEIGHT, 0), 0);

/**
 * Overflow rule: at most LIST_EVENTS_MAX events in priority order, then the lowest-priority ones are
 * dropped until the list fits its height; every dropped event is counted in `more`.
 */
export const paginateWeek = (events: WeekEvent[]) => {
  let listed = events.slice(0, LIST_EVENTS_MAX);
  let days = groupWeekDays(listed);
  while (listed.length > 1 && estimateListHeight(days) > LIST_HEIGHT_BUDGET) {
    listed = listed.slice(0, -1);
    days = groupWeekDays(listed);
  }
  return { days, more: events.length - listed.length };
};

const isWeekendDay = (day: string) => {
  const weekday = new Date(`${day}T12:00:00Z`).getUTCDay();
  return weekday === 0 || weekday === 6;
};

/** The snapshot of one week (Monday `monday`), or null when no race is listed. */
export const buildWeekSnapshot = (events: WeekEvent[], monday: string): WeekSnapshot | null => {
  const selected = selectWeekEvents(events, monday);
  if (!selected.length) return null;
  const range = formatWeekRange(monday, addDays(monday, 6));
  const { days, more } = paginateWeek(selected);
  const allWeekend = selected.every((event) => event.formats.every((format) => isWeekendDay(format.date)));
  const count = selected.length;
  return {
    series: "week",
    range,
    subtitle: `SEMAINE ${isoWeekNumber(monday)} · ${count} ${count > 1 ? "COURSES" : "COURSE"}${allWeekend ? " · TOUT SE JOUE LE WEEK-END" : ""}`,
    label: `LA SEMAINE QUI VIENT · ${range}`,
    planks: selected.slice(0, COVER_PLANKS_MAX).map((event, index) => ({
      name: event.name,
      cotes: plankCotes(event),
      side: index % 2 === 0 ? "right" : "left",
    })),
    days,
    more,
    eventCount: count,
  };
};
