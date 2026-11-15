/**
 * Official RaceBook cutoff resolution, runtime-neutral.
 *
 * This mirrors the runner RaceBook rules in
 * `apps/mobile/lib/racebookPlanReflection.ts` (mobile keeps its local copy
 * because it does not import this package at runtime). Organizer cutoffs are
 * free text such as "15:00", "sam. 15h", "dimanche 15/11 à 14h30" or
 * "minuit". They are resolved in course order from the official departure, so
 * a clock-only cutoff never lands before the previous one: a 184 km race
 * starting at 14:00 places "01:00" on J+2 after a "12:00" cutoff on J+1.
 */

const DAY_MINUTES = 24 * 60;

export type OrganizerCutoff = {
  minuteOfDay: number;
  date: { day: number; month: number } | null;
};

export type OfficialCutoffInput = {
  id: string;
  km: number;
  cutoff: string | null | undefined;
};

/** A resolved race-day clock: calendar date (when known), HH:mm and day offset from the race date. */
export type RaceDayClock = {
  date: string | null;
  time: string;
  dayOffset: number;
};

export function clockToMinutes(value: string | null | undefined): number | null {
  const match = /^(\d{1,2})(?:(?::|h)(\d{0,2}))?(?::\d{2})?$/i.exec(value?.trim() ?? "");
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2] || 0);
  if (!Number.isInteger(hours) || !Number.isInteger(minutes) || hours > 23 || minutes > 59) return null;
  return hours * 60 + minutes;
}

/** Display-safe HH:mm for a standalone clock ("7h", "07:00:00"); null for any richer wording. */
export function normalizeSimpleClock(value: string | null | undefined): string | null {
  const minutes = clockToMinutes(value);
  if (minutes === null) return null;
  return `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
}

/** Reads the clock (and optional dd/mm date) inside organizer cutoff wording. */
export function parseOrganizerCutoff(value: string | null | undefined): OrganizerCutoff | null {
  const text = (value ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLocaleLowerCase("fr")
    .replace(/\([^)]*\)/g, " ")
    .trim();
  if (!text) return null;

  const dateMatch = /\b(\d{1,2})\/(\d{1,2})\b/.exec(text);
  const day = dateMatch ? Number(dateMatch[1]) : NaN;
  const month = dateMatch ? Number(dateMatch[2]) : NaN;
  const date = day >= 1 && day <= 31 && month >= 1 && month <= 12 ? { day, month } : null;
  const withoutDate = dateMatch ? text.replace(dateMatch[0], " ") : text;

  let minuteOfDay: number | null = null;
  if (/\bminuit\b|\bmidnight\b/.test(withoutDate)) minuteOfDay = 0;
  else if (/\bmidi\b|\bnoon\b/.test(withoutDate)) minuteOfDay = 12 * 60;
  else {
    const clockMatch = /\b(\d{1,2})\s*(?::|h)\s*(\d{2})?(?!\d)/.exec(withoutDate);
    if (clockMatch) {
      const hours = Number(clockMatch[1]);
      const minutes = Number(clockMatch[2] || 0);
      if (hours <= 23 && minutes <= 59) minuteOfDay = hours * 60 + minutes;
    }
  }
  return minuteOfDay === null ? null : { minuteOfDay, date };
}

function daysBetweenRaceDateAnd(raceDate: string | null | undefined, date: { day: number; month: number }) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(raceDate ?? "");
  if (!match) return null;
  const year = Number(match[1]);
  const start = Date.UTC(year, Number(match[2]) - 1, Number(match[3]));
  let target = Date.UTC(year, date.month - 1, date.day);
  if (target < start) target = Date.UTC(year + 1, date.month - 1, date.day);
  const days = Math.round((target - start) / (DAY_MINUTES * 60_000));
  return days >= 0 && days <= 6 ? days : null;
}

/** Resolves every official cutoff to elapsed minutes after the official departure. */
export function resolveOfficialCutoffSchedule(
  departureClock: string | null | undefined,
  raceDate: string | null | undefined,
  cutoffs: readonly OfficialCutoffInput[],
): Record<string, number> {
  const departureMinute = clockToMinutes(departureClock);
  if (departureMinute === null) return {};

  const schedule: Record<string, number> = {};
  let previous = 0;
  cutoffs
    .slice()
    .sort((left, right) => left.km - right.km)
    .forEach((entry) => {
      const parsed = parseOrganizerCutoff(entry.cutoff);
      if (!parsed) return;
      const dayOffset = parsed.date ? daysBetweenRaceDateAnd(raceDate, parsed.date) : null;
      let elapsed: number | null = dayOffset === null
        ? null
        : dayOffset * DAY_MINUTES + parsed.minuteOfDay - departureMinute;
      if (elapsed === null || elapsed <= 0 || elapsed < previous) {
        elapsed = (parsed.minuteOfDay - departureMinute + DAY_MINUTES) % DAY_MINUTES || DAY_MINUTES;
        while (elapsed < previous) elapsed += DAY_MINUTES;
      }
      schedule[entry.id] = elapsed;
      previous = elapsed;
    });
  return schedule;
}

function addDays(isoDate: string | null | undefined, days: number): string | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(isoDate ?? "");
  if (!match) return null;
  const value = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]) + days));
  return value.toISOString().slice(0, 10);
}

/** Converts elapsed minutes after the departure into a calendar race-day clock, without device timezones. */
export function toRaceDayClock(
  departureClock: string | null | undefined,
  raceDate: string | null | undefined,
  elapsedMinutes: number,
): RaceDayClock | null {
  const departureMinute = clockToMinutes(departureClock);
  if (departureMinute === null || !Number.isFinite(elapsedMinutes) || elapsedMinutes < 0) return null;
  const absoluteMinute = departureMinute + Math.round(elapsedMinutes);
  const dayOffset = Math.floor(absoluteMinute / DAY_MINUTES);
  const clockMinute = absoluteMinute % DAY_MINUTES;
  return {
    date: addDays(raceDate, dayOffset),
    time: `${String(Math.floor(clockMinute / 60)).padStart(2, "0")}:${String(clockMinute % 60).padStart(2, "0")}`,
    dayOffset,
  };
}

/** Only an explicitly named last checkpoint is the finish (same rule as the runner RaceBook). */
export function isExplicitFinishName(name: string): boolean {
  const normalized = name.normalize("NFD").replace(/[̀-ͯ]/g, "").toLocaleLowerCase("fr").trim().replace(/\s+/g, " ");
  return normalized === "arrivee" || normalized === "finish";
}
