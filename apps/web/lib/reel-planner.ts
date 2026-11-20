/**
 * Automatic reel calendar (pure). Decides which catalog formats get a reel and on which day it is
 * published, from plain rows. See docs/05-integrations/reel-automation.md for the rules and
 * docs/08-decisions/2026-11-19-reel-highlights-and-figures.md (decision 15).
 *
 * Dates are calendar days `YYYY-MM-DD` in Europe/Paris; weeks run Monday to Sunday.
 */

export type ReelPlanMode = "full" | "highlights";

/** One catalog format (a `races` row with its event and edition dates). */
export type PlannerFormat = {
  raceId: string;
  name: string;
  distanceKm: number;
  isLive: boolean;
  hasGpx: boolean;
  aidStationCount: number;
  /** `races.race_date`, `race_event_editions.start_date`, `race_events.race_date`: the first set wins. */
  raceDate: string | null;
  editionStartDate: string | null;
  eventDate: string | null;
  eventId: string | null;
  editionId: string | null;
  eventName?: string | null;
};

/** A render job or a social post of a race that is not failed (manual or earlier automatic reel). */
export type PlannerPriorReel = { raceId: string; createdAt: string };

/** Automation items that are no longer `planned` (or skipped automatically): the plan keeps them. */
export type PlannerLockedItem = {
  raceId: string;
  editionKey: string;
  plannedPublishDate: string;
  status: "generating" | "rendering" | "drafted" | "scheduled" | "failed" | "skipped";
};

export type PlannerOptions = {
  /** Today in Paris (`YYYY-MM-DD`). */
  today: string;
  /** Days between the generation start and the publication day (default 3). */
  leadDays?: number;
  maxPerWeek?: number;
  maxPerDay?: number;
  /** Paris days already taken by other publications (scheduled posts made by hand). */
  occupiedDates?: string[];
};

export type PlannedReel = {
  raceId: string;
  editionKey: string;
  mode: ReelPlanMode;
  plannedPublishDate: string;
  generateOn: string;
  eventStart: string;
  raceName: string;
  distanceKm: number;
};

export type ReelSkipReason = "too_late" | "duplicate";

export type SkippedReel = {
  raceId: string;
  editionKey: string;
  mode: ReelPlanMode;
  /** The day it would have needed (the latest day the rules allow), for the admin. */
  targetDate: string;
  eventStart: string;
  raceName: string;
  distanceKm: number;
  reason: ReelSkipReason;
};

export type ReelPlan = { planned: PlannedReel[]; skipped: SkippedReel[] };

export const REEL_MIN_DISTANCE_KM = 30;
/** Up to 60 km the whole course is flown (Parcours complet); beyond, the highlights (Temps forts). */
export const REEL_FULL_MAX_DISTANCE_KM = 60;
export const REEL_SPACING_DAYS = 7;
export const DEFAULT_REEL_LEAD_DAYS = 3;
export const DEFAULT_REEL_MAX_PER_WEEK = 3;
export const DEFAULT_REEL_MAX_PER_DAY = 1;
/** Publication time of an automatic reel, Paris wall time. */
export const DEFAULT_REEL_PUBLISH_TIME = "18:00";
/**
 * A reel of the race created this many days before its date (or later) belongs to this edition.
 * Editions are yearly and reels are made in the weeks before a race, so last year's reel of a
 * reused race row is always older; a 180-day window also covers early announcements.
 */
export const REEL_DUPLICATE_WINDOW_DAYS = 180;

const TEAM_FORMAT_PATTERN = /relais|relay|duo|team/i;
const DAY_PATTERN = /^\d{4}-\d{2}-\d{2}/;
const DAY_MS = 86_400_000;

const toDay = (value: string | null | undefined) => (value && DAY_PATTERN.test(value) ? value.slice(0, 10) : null);
const dayNumber = (day: string) => Math.floor(Date.parse(`${day}T00:00:00Z`) / DAY_MS);
const fromDayNumber = (value: number) => new Date(value * DAY_MS).toISOString().slice(0, 10);
export const addDays = (day: string, days: number) => fromDayNumber(dayNumber(day) + days);
/** Monday of the week of `day` (weeks run Monday to Sunday). */
export const weekStart = (day: string) => {
  const value = dayNumber(day);
  const dow = (new Date(value * DAY_MS).getUTCDay() + 6) % 7;
  return fromDayNumber(value - dow);
};

/** Today's date in Paris. */
export const parisToday = (now: Date = new Date()) =>
  new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Paris", year: "numeric", month: "2-digit", day: "2-digit" }).format(now);

/** The format's date: its own date, else its edition start, else the event date. */
export const getFormatDate = (format: Pick<PlannerFormat, "raceDate" | "editionStartDate" | "eventDate">) =>
  toDay(format.raceDate) ?? toDay(format.editionStartDate) ?? toDay(format.eventDate);

/** Key of the yearly edition a format belongs to: the edition id, else the event and year, else the race and day. */
export const getEditionKey = (format: Pick<PlannerFormat, "raceId" | "eventId" | "editionId" | "raceDate" | "editionStartDate" | "eventDate">) => {
  const date = getFormatDate(format) ?? "undated";
  if (format.editionId) return `edition:${format.editionId}`;
  if (format.eventId) return `event:${format.eventId}:${date.slice(0, 4)}`;
  return `race:${format.raceId}:${date}`;
};

export const getReelMode = (distanceKm: number): ReelPlanMode => (distanceKm > REEL_FULL_MAX_DISTANCE_KM ? "highlights" : "full");

/** Rule 1: a live, solo format with its GPX, at least one aid station, 30 km or more, in the future. */
export const isEligibleFormat = (format: PlannerFormat, today: string) => {
  const date = getFormatDate(format);
  return format.isLive
    && !TEAM_FORMAT_PATTERN.test(format.name)
    && format.hasGpx
    && format.aidStationCount >= 1
    && Number.isFinite(format.distanceKm)
    && format.distanceKm >= REEL_MIN_DISTANCE_KM
    && date !== null
    && date > today;
};

/** Rule 6: a non-failed render or post of the race created in this edition's window. */
export const hasPriorReel = (raceId: string, formatDate: string, priorReels: PlannerPriorReel[]) => {
  const windowStart = addDays(formatDate, -REEL_DUPLICATE_WINDOW_DAYS);
  return priorReels.some((reel) => reel.raceId === raceId && toDay(reel.createdAt) !== null && (toDay(reel.createdAt) as string) >= windowStart);
};

const OCCUPYING_STATUSES = new Set<PlannerLockedItem["status"]>(["generating", "rendering", "drafted", "scheduled"]);

type Candidate = PlannerFormat & { date: string; editionKey: string; mode: ReelPlanMode };

/**
 * Builds the plan. Per edition, formats publish from the shortest to the longest: the longest at
 * the event start − 7 days at the latest, each shorter one at least 7 days before the next longer
 * one. Editions are assigned in event order (earliest first: they have the fewest days left), each
 * from its longest format down, on the latest free day at or before its target that keeps at most
 * `maxPerDay` reels a day and `maxPerWeek` a week. A format with no free day from today + lead
 * time is skipped as too late, never compressed. Locked items keep their day and count in the caps.
 */
export const planReels = (
  formats: PlannerFormat[],
  priorReels: PlannerPriorReel[],
  lockedItems: PlannerLockedItem[],
  options: PlannerOptions,
): ReelPlan => {
  const leadDays = options.leadDays ?? DEFAULT_REEL_LEAD_DAYS;
  const maxPerWeek = options.maxPerWeek ?? DEFAULT_REEL_MAX_PER_WEEK;
  const maxPerDay = options.maxPerDay ?? DEFAULT_REEL_MAX_PER_DAY;
  const minDay = addDays(options.today, leadDays);

  const perDay = new Map<string, number>();
  const perWeek = new Map<string, number>();
  const occupy = (day: string) => {
    perDay.set(day, (perDay.get(day) ?? 0) + 1);
    perWeek.set(weekStart(day), (perWeek.get(weekStart(day)) ?? 0) + 1);
  };
  const isFree = (day: string) => (perDay.get(day) ?? 0) < maxPerDay && (perWeek.get(weekStart(day)) ?? 0) < maxPerWeek;
  (options.occupiedDates ?? []).forEach((day) => { if (toDay(day)) occupy(toDay(day) as string); });
  lockedItems.forEach((item) => { if (OCCUPYING_STATUSES.has(item.status) && toDay(item.plannedPublishDate)) occupy(toDay(item.plannedPublishDate) as string); });

  const lockedByKey = new Map(lockedItems.map((item) => [`${item.raceId}|${item.editionKey}`, item]));

  const groups = new Map<string, Candidate[]>();
  formats
    .filter((format) => isEligibleFormat(format, options.today))
    .forEach((format) => {
      const date = getFormatDate(format) as string;
      const editionKey = getEditionKey(format);
      const candidate: Candidate = { ...format, date, editionKey, mode: getReelMode(format.distanceKm) };
      groups.set(editionKey, [...(groups.get(editionKey) ?? []), candidate]);
    });

  const orderedGroups = Array.from(groups.entries())
    .map(([key, members]) => ({ key, members, eventStart: members.map((member) => member.date).sort()[0] }))
    .sort((left, right) => left.eventStart.localeCompare(right.eventStart) || left.key.localeCompare(right.key));

  const planned: PlannedReel[] = [];
  const skipped: SkippedReel[] = [];

  for (const group of orderedGroups) {
    const longestFirst = [...group.members].sort((left, right) => right.distanceKm - left.distanceKm || left.raceId.localeCompare(right.raceId));
    // Day the next shorter format must stay at least 7 days before.
    let anchor = group.eventStart;
    for (const format of longestFirst) {
      const base = { raceId: format.raceId, editionKey: format.editionKey, mode: format.mode, eventStart: group.eventStart, raceName: format.name, distanceKm: format.distanceKm };
      const target = addDays(anchor, -REEL_SPACING_DAYS);
      const locked = lockedByKey.get(`${format.raceId}|${format.editionKey}`);
      if (locked) {
        // Already handled (in flight, done, excluded or failed): it keeps its day, or leaves the chain.
        if (OCCUPYING_STATUSES.has(locked.status)) anchor = toDay(locked.plannedPublishDate) ?? anchor;
        continue;
      }
      if (hasPriorReel(format.raceId, format.date, priorReels)) {
        skipped.push({ ...base, targetDate: target, reason: "duplicate" });
        continue;
      }
      let day = target;
      while (day >= minDay && !isFree(day)) day = addDays(day, -1);
      if (day < minDay) {
        skipped.push({ ...base, targetDate: target, reason: "too_late" });
        continue;
      }
      occupy(day);
      anchor = day;
      planned.push({ ...base, plannedPublishDate: day, generateOn: addDays(day, -leadDays) });
    }
  }

  planned.sort((left, right) => left.plannedPublishDate.localeCompare(right.plannedPublishDate) || left.raceId.localeCompare(right.raceId));
  skipped.sort((left, right) => left.targetDate.localeCompare(right.targetDate) || left.raceId.localeCompare(right.raceId));
  return { planned, skipped };
};
