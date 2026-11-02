import type { PlanRow, RaceSection } from '../components/plans/types';

export type DepartureCountdownCopy = {
  notSet: string;
  passed: string;
  inDays: (days: number) => string;
  inHoursAndMinutes: (hours: number, minutes: number) => string;
  inMinutesAndSeconds: (minutes: number, seconds: number) => string;
};

export type PlanPrimaryAction = 'edit' | 'start' | 'recap';

function departureMs(plan: PlanRow) {
  const value = plan.departureAt ? new Date(plan.departureAt).getTime() : Number.NaN;
  return Number.isFinite(value) ? value : null;
}

export function isPlanDeparturePast(departureAt: string | null | undefined, nowMs: number) {
  if (!departureAt) return false;
  const departure = new Date(departureAt);
  if (!Number.isFinite(departure.getTime()) || !Number.isFinite(nowMs)) return false;

  return nowMs >= new Date(
    departure.getFullYear(),
    departure.getMonth(),
    departure.getDate() + 1,
  ).getTime();
}

function comparePlansByDeparture(left: PlanRow, right: PlanRow, nowMs: number) {
  const leftDeparture = departureMs(left);
  const rightDeparture = departureMs(right);
  const leftRank = leftDeparture == null ? 1 : leftDeparture > nowMs ? 0 : 2;
  const rightRank = rightDeparture == null ? 1 : rightDeparture > nowMs ? 0 : 2;
  if (leftRank !== rightRank) return leftRank - rightRank;
  if (leftDeparture != null && rightDeparture != null && leftDeparture !== rightDeparture) {
    return leftDeparture - rightDeparture;
  }
  return left.name.localeCompare(right.name);
}

export function sortPlanSections(sections: RaceSection[], nowMs: number, pastRacesLabel: string) {
  const pastSections: RaceSection[] = [];
  const activeSections: RaceSection[] = [];
  const orphanSection = sections.find((section) => section.sectionKey === '__orphan__');

  for (const section of sections) {
    if (section.sectionKey === '__orphan__') continue;
    const data = [...section.data].sort((left, right) => comparePlansByDeparture(left, right, nowMs));
    const hasOnlyPastDatedPlans = data.length > 0
      && data.every((plan) => isPlanDeparturePast(plan.departureAt, nowMs));

    if (hasOnlyPastDatedPlans) pastSections.push({ ...section, data });
    else activeSections.push({ ...section, data });
  }

  activeSections.sort((left, right) => {
    const nextDeparture = (section: RaceSection) => section.data
      .map(departureMs)
      .filter((value): value is number => value != null && value > nowMs)[0] ?? Number.POSITIVE_INFINITY;
    const difference = nextDeparture(left) - nextDeparture(right);
    return difference || left.eventName.localeCompare(right.eventName);
  });

  if (pastSections.length > 0) {
    pastSections.sort((left, right) => left.eventName.localeCompare(right.eventName));
    const pastEventNames = Object.fromEntries(
      pastSections.flatMap((section) => section.data.map((plan) => [plan.id, section.eventName])),
    );
    activeSections.push({
      sectionKey: '__past__',
      raceId: null,
      eventName: pastRacesLabel,
      isOwned: false,
      data: pastSections.flatMap((section) => section.data),
      pastEventNames,
      pastEventStartIds: pastSections
        .map((section) => section.data[0]?.id)
        .filter((value): value is string => Boolean(value)),
    });
  }

  if (orphanSection) {
    activeSections.push({
      ...orphanSection,
      data: [...orphanSection.data].sort((left, right) => comparePlansByDeparture(left, right, nowMs)),
    });
  }

  return activeSections;
}

export function formatDepartureCountdown(
  departureAt: string | null | undefined,
  nowMs: number,
  copy: DepartureCountdownCopy,
) {
  if (!departureAt) return copy.notSet;
  const targetMs = new Date(departureAt).getTime();
  if (!Number.isFinite(targetMs)) return copy.notSet;

  const remainingSeconds = Math.floor((targetMs - nowMs) / 1_000);
  if (remainingSeconds <= 0) return copy.passed;

  const days = Math.floor(remainingSeconds / 86_400);
  if (days >= 2) return copy.inDays(days);

  const hours = Math.floor(remainingSeconds / 3_600);
  const minutes = Math.floor((remainingSeconds % 3_600) / 60);
  if (hours >= 1) return copy.inHoursAndMinutes(hours, minutes);

  return copy.inMinutesAndSeconds(minutes, remainingSeconds % 60);
}

function localDateKey(date: Date) {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0'),
  ].join('-');
}

export function resolvePlanPrimaryAction(
  plan: Pick<PlanRow, 'id' | 'departureAt' | 'races'>,
  nowMs: number,
  activePlanId: string | null,
): PlanPrimaryAction {
  if (plan.id === activePlanId) return 'start';

  const now = new Date(nowMs);
  if (!Number.isFinite(now.getTime())) return 'edit';

  const raceDate = plan.races?.race_date;
  const departure = plan.departureAt ? new Date(plan.departureAt) : null;
  const planDate = raceDate && /^\d{4}-\d{2}-\d{2}$/.test(raceDate)
    ? raceDate
    : departure && Number.isFinite(departure.getTime())
      ? localDateKey(departure)
      : null;

  if (!planDate) return 'edit';

  const today = localDateKey(now);
  if (planDate === today) return 'start';
  return planDate < today ? 'recap' : 'edit';
}
