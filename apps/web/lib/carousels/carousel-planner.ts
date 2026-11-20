import { addDays, getEditionKey, getFormatDate, REEL_DUPLICATE_WINDOW_DAYS } from "../reel-planner";
import { CAROUSEL_SERIES, type CarouselSeries } from "./carousel-snapshot";

/**
 * Weekly carousel slots (pure): Tuesday « Le plan chiffré », Thursday « Le brief », Sunday « La
 * semaine qui vient », each on its fixed weekday at the automation publish time. Reels avoid those
 * weekdays (at most one post a day across reels and carousels). Rules:
 * docs/05-integrations/instagram-carousels.md (« Planning »). Dates are Paris days `YYYY-MM-DD`.
 */

/** Weekday of each series (0 = Sunday, as `Date.getUTCDay`). */
export const CAROUSEL_SERIES_WEEKDAY: Record<CarouselSeries, number> = { plan: 2, brief: 4, week: 0 };
/** How far ahead slots are planned. */
export const CAROUSEL_HORIZON_DAYS = 21;
/** Days between the slot and the race: Plan chiffré 2 to 4 weeks, Brief 7 to 14 days. */
export const CAROUSEL_RACE_WINDOW: Record<"plan" | "brief", { from: number; to: number }> = {
  plan: { from: 14, to: 28 },
  brief: { from: 7, to: 14 },
};

const TEAM_FORMAT_PATTERN = /relais|relay|\bduo|team|[ée]quipe|marche|rando|walk|nordique/i;

export type CarouselFormat = {
  raceId: string;
  name: string;
  distanceKm: number;
  elevationGainM: number | null;
  isLive: boolean;
  hasGpx: boolean;
  aidStationCount: number;
  participationMode: string | null;
  raceDate: string | null;
  editionStartDate: string | null;
  eventDate: string | null;
  eventId: string | null;
  editionId: string | null;
};

/** A non-failed reel or carousel of a race (render or post). */
export type CarouselCoverage = { raceId: string; createdAt: string; kind: "reel" | "carousel"; series: CarouselSeries | null };

/** Slots no longer recomputed (in flight, done, excluded, failed). */
export type CarouselLockedSlot = {
  series: CarouselSeries;
  plannedPublishDate: string;
  status: "generating" | "rendering" | "drafted" | "scheduled" | "skipped" | "failed";
  editionKey: string | null;
};

export type CarouselSlotReason = "too_late" | "no_candidate" | "occupied";

export type CarouselSlot = {
  series: CarouselSeries;
  plannedPublishDate: string;
  status: "planned" | "skipped";
  reason: CarouselSlotReason | null;
  raceId: string | null;
  editionKey: string | null;
  weekStart: string | null;
  raceName: string | null;
};

export type CarouselPlanOptions = {
  today: string;
  leadDays: number;
  enabledSeries: CarouselSeries[];
  /** Paris days already taken by another publication (reel items, posts scheduled by hand). */
  occupiedDates: string[];
  /** Listed races per week (Monday → count), for « La semaine qui vient ». */
  weekEventCounts: Record<string, number>;
};

const weekdayOf = (day: string) => new Date(`${day}T12:00:00Z`).getUTCDay();

/** Weekdays reels must avoid: those of the enabled carousel series. */
export const carouselWeekdays = (enabledSeries: CarouselSeries[]) => enabledSeries.map((series) => CAROUSEL_SERIES_WEEKDAY[series]);

/** Slot days of a series from `today` (included) to the horizon. */
export const slotDays = (series: CarouselSeries, today: string, horizonDays = CAROUSEL_HORIZON_DAYS) => {
  const days: string[] = [];
  for (let offset = 0; offset <= horizonDays; offset += 1) {
    const day = addDays(today, offset);
    if (weekdayOf(day) === CAROUSEL_SERIES_WEEKDAY[series]) days.push(day);
  }
  return days;
};

/** A live solo format with a distance (and a D+ for the plan, aid stations for the brief). */
export const isCarouselCandidate = (series: "plan" | "brief", format: CarouselFormat) =>
  format.isLive
  && format.participationMode !== "relay"
  && !TEAM_FORMAT_PATTERN.test(format.name)
  && Number.isFinite(format.distanceKm)
  && format.distanceKm > 0
  && (series === "plan" ? format.elevationGainM !== null : format.aidStationCount >= 1);

const isRecent = (coverage: CarouselCoverage, formatDate: string) =>
  coverage.createdAt.slice(0, 10) >= addDays(formatDate, -REEL_DUPLICATE_WINDOW_DAYS);

/**
 * Best race for a slot: in the series window, not an edition already used by the series, never an
 * edition with a post of the same series; then prefer races without any reel or carousel yet,
 * with aid stations, with a GPX, the earliest, the longest (ties by race id).
 */
export const pickRace = (
  series: "plan" | "brief",
  slotDay: string,
  formats: CarouselFormat[],
  coverage: CarouselCoverage[],
  usedEditions: Set<string>,
) => {
  const window = CAROUSEL_RACE_WINDOW[series];
  const from = addDays(slotDay, window.from);
  const to = addDays(slotDay, window.to);
  const seriesCovered = new Set<string>();
  const anyCovered = new Set<string>();
  const candidates = formats.flatMap((format) => {
    const date = getFormatDate(format);
    if (!date || date < from || date > to || !isCarouselCandidate(series, format)) return [];
    const editionKey = getEditionKey(format);
    if (usedEditions.has(editionKey)) return [];
    const raceCoverage = coverage.filter((entry) => entry.raceId === format.raceId && isRecent(entry, date));
    if (raceCoverage.some((entry) => entry.kind === "carousel" && entry.series === series)) seriesCovered.add(editionKey);
    if (raceCoverage.length) anyCovered.add(format.raceId);
    return [{ format, date, editionKey }];
  }).filter((candidate) => !seriesCovered.has(candidate.editionKey));
  candidates.sort((left, right) =>
    Number(anyCovered.has(left.format.raceId)) - Number(anyCovered.has(right.format.raceId))
    || Number(right.format.aidStationCount > 0) - Number(left.format.aidStationCount > 0)
    || Number(right.format.hasGpx) - Number(left.format.hasGpx)
    || left.date.localeCompare(right.date)
    || right.format.distanceKm - left.format.distanceKm
    || left.format.raceId.localeCompare(right.format.raceId));
  return candidates[0] ?? null;
};

const LOCKED_USING_EDITION = new Set(["generating", "rendering", "drafted", "scheduled"]);

/**
 * The slots of the enabled series. Locked slots keep their state and their edition counts as
 * used. A free slot is planned with its race (or week); it is skipped when its day is taken by
 * another publication, when no race fits, or when it is closer than the generation lead time.
 */
export const planCarousels = (
  formats: CarouselFormat[],
  coverage: CarouselCoverage[],
  locked: CarouselLockedSlot[],
  options: CarouselPlanOptions,
): CarouselSlot[] => {
  const minDay = addDays(options.today, options.leadDays);
  const occupied = new Set(options.occupiedDates.map((day) => day.slice(0, 10)));
  const lockedByKey = new Map(locked.map((slot) => [`${slot.series}|${slot.plannedPublishDate}`, slot]));
  const slots: CarouselSlot[] = [];

  for (const series of CAROUSEL_SERIES) {
    if (!options.enabledSeries.includes(series)) continue;
    const usedEditions = new Set(locked
      .filter((slot) => slot.series === series && slot.editionKey && LOCKED_USING_EDITION.has(slot.status))
      .map((slot) => slot.editionKey as string));
    for (const day of slotDays(series, options.today)) {
      if (lockedByKey.has(`${series}|${day}`)) continue;
      const base = { series, plannedPublishDate: day, raceId: null, editionKey: null, weekStart: null, raceName: null };
      if (day < minDay) {
        slots.push({ ...base, status: "skipped", reason: "too_late" });
        continue;
      }
      if (occupied.has(day)) {
        slots.push({ ...base, status: "skipped", reason: "occupied" });
        continue;
      }
      if (series === "week") {
        const monday = addDays(day, 1);
        const count = options.weekEventCounts[monday] ?? 0;
        slots.push(count > 0
          ? { ...base, weekStart: monday, status: "planned", reason: null }
          : { ...base, weekStart: monday, status: "skipped", reason: "no_candidate" });
        continue;
      }
      const picked = pickRace(series, day, formats, coverage, usedEditions);
      if (!picked) {
        slots.push({ ...base, status: "skipped", reason: "no_candidate" });
        continue;
      }
      usedEditions.add(picked.editionKey);
      slots.push({ ...base, status: "planned", reason: null, raceId: picked.format.raceId, editionKey: picked.editionKey, raceName: picked.format.name });
    }
  }
  return slots.sort((left, right) => left.plannedPublishDate.localeCompare(right.plannedPublishDate) || left.series.localeCompare(right.series));
};
