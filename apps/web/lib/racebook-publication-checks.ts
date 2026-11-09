/**
 * Pure pre-publication quality checks for one RaceBook format snapshot.
 *
 * Blocking issues describe content that is visibly broken for runners (an aid
 * station still carrying the editor's placeholder name, or an intermediate aid
 * station placed at kilometre 0 on top of the start). Warnings never block:
 * they point at values that are often mistakes but can be legitimate, such as
 * an encouragement point sharing a place name with a ravito at another
 * kilometre.
 */

export const DEFAULT_AID_STATION_NAME = "Nouveau ravito";

export type RacebookPublicationIssueSeverity = "blocking" | "warning";

export type RacebookPublicationIssueCode =
  | "aid_station_default_name"
  | "aid_station_at_start"
  | "place_name_km_mismatch"
  | "race_date_outside_edition"
  | "lowercase_name";

export type RacebookPublicationIssue = {
  code: RacebookPublicationIssueCode;
  severity: RacebookPublicationIssueSeverity;
  message: string;
};

export type RacebookPublicationCheckInput = {
  raceName: string | null;
  raceDate: string | null;
  raceLocation: string | null;
  eventName: string | null;
  eventLocation: string | null;
  editionStartDate: string | null;
  editionEndDate: string | null;
  aidStations: Array<{ name: string | null; km: number | null }>;
  supporterPoints: Array<{ name: string | null; km: number | null }>;
};

/** Distances closer than this are treated as the same physical place. */
const SAME_PLACE_TOLERANCE_KM = 0.5;

export const normalizePlaceName = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLocaleLowerCase("fr")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\b(st)\b/g, "saint")
    .trim();

const startsLowercase = (value: string | null) => {
  const trimmed = value?.trim() ?? "";
  return /^\p{Ll}/u.test(trimmed);
};

const isoDay = (value: string | null) => {
  const match = value?.match(/^(\d{4}-\d{2}-\d{2})/);
  return match ? match[1] : null;
};

const formatKm = (km: number) => `${Number.isInteger(km) ? km : km.toFixed(1).replace(".", ",")} km`;

const formatDay = (day: string) => {
  const [year, month, date] = day.split("-");
  return `${date}/${month}/${year}`;
};

export function evaluateRacebookPublicationChecks(input: RacebookPublicationCheckInput): RacebookPublicationIssue[] {
  const issues: RacebookPublicationIssue[] = [];
  const stations = input.aidStations.map((station) => ({
    name: station.name?.trim() ?? "",
    km: typeof station.km === "number" && Number.isFinite(station.km) ? station.km : null,
  }));

  for (const station of stations) {
    if (normalizePlaceName(station.name) === normalizePlaceName(DEFAULT_AID_STATION_NAME) || station.name.length === 0) {
      issues.push({
        code: "aid_station_default_name",
        severity: "blocking",
        message: `Un ravito s’appelle encore « ${station.name || "sans nom"} ». Donne-lui le nom du lieu avant de publier.`,
      });
    }
    if (station.km !== null && station.km <= 0) {
      issues.push({
        code: "aid_station_at_start",
        severity: "blocking",
        message: `Le ravito « ${station.name || "sans nom"} » est placé à 0 km, au même endroit que le départ. Indique son vrai kilomètre ou supprime-le.`,
      });
    }
  }

  const reported = new Set<string>();
  for (const point of input.supporterPoints) {
    const name = point.name?.trim() ?? "";
    const key = normalizePlaceName(name);
    if (!key || typeof point.km !== "number" || !Number.isFinite(point.km)) continue;
    for (const station of stations) {
      if (station.km === null || normalizePlaceName(station.name) !== key) continue;
      if (Math.abs(station.km - point.km) <= SAME_PLACE_TOLERANCE_KM) continue;
      const pairKey = `${key}:${station.km}:${point.km}`;
      if (reported.has(pairKey)) continue;
      reported.add(pairKey);
      issues.push({
        code: "place_name_km_mismatch",
        severity: "warning",
        message: `« ${name} » apparaît à ${formatKm(station.km)} (ravito) et à ${formatKm(point.km)} (suivi coureur). Vérifie que c’est voulu.`,
      });
    }
  }

  const raceDay = isoDay(input.raceDate);
  const startDay = isoDay(input.editionStartDate);
  const endDay = isoDay(input.editionEndDate);
  if (raceDay && startDay && endDay && (raceDay < startDay || raceDay > endDay)) {
    issues.push({
      code: "race_date_outside_edition",
      severity: "warning",
      message: `La date du format (${formatDay(raceDay)}) est en dehors des dates de l’édition (${formatDay(startDay)} – ${formatDay(endDay)}).`,
    });
  }

  const lowercaseLabels: Array<[string | null, string]> = [
    [input.eventName, "Le nom de l’événement"],
    [input.eventLocation, "Le lieu de l’événement"],
    [input.raceName, "Le nom du format"],
    [input.raceLocation, "Le lieu du format"],
  ];
  for (const [value, label] of lowercaseLabels) {
    if (startsLowercase(value)) {
      issues.push({
        code: "lowercase_name",
        severity: "warning",
        message: `${label} commence par une minuscule (« ${value!.trim()} »).`,
      });
    }
  }
  const lowercasePlaces = [...stations.map((station) => station.name), ...input.supporterPoints.map((point) => point.name?.trim() ?? "")]
    .filter((name) => startsLowercase(name));
  for (const name of [...new Set(lowercasePlaces)]) {
    issues.push({
      code: "lowercase_name",
      severity: "warning",
      message: `Le point « ${name} » commence par une minuscule.`,
    });
  }

  return issues;
}

export const hasBlockingRacebookPublicationIssue = (issues: readonly RacebookPublicationIssue[]) =>
  issues.some((issue) => issue.severity === "blocking");

const asRecord = (value: unknown): Record<string, unknown> =>
  value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};

const text = (value: unknown) => (typeof value === "string" ? value : null);
const num = (value: unknown) => {
  const parsed = typeof value === "number" ? value : typeof value === "string" ? Number(value) : Number.NaN;
  return Number.isFinite(parsed) ? parsed : null;
};

/** Builds check input from a published-snapshot shape plus edition dates. */
export function racebookPublicationCheckInputFromSnapshot(
  snapshot: { raceRow: Record<string, unknown>; stationRows: Array<Record<string, unknown>>; supporterPointRows: Array<Record<string, unknown>> },
  edition: { start_date: string | null; end_date: string | null } | null,
): RacebookPublicationCheckInput {
  const race = asRecord(snapshot.raceRow);
  const rawEvent = Array.isArray(race.race_events) ? race.race_events[0] : race.race_events;
  const event = asRecord(rawEvent);
  return {
    raceName: text(race.name),
    raceDate: text(race.race_date),
    raceLocation: text(race.location_text),
    eventName: text(event.name),
    eventLocation: text(event.location),
    editionStartDate: edition?.start_date ?? null,
    editionEndDate: edition?.end_date ?? null,
    aidStations: snapshot.stationRows.map((row) => ({ name: text(row.name), km: num(row.km) })),
    supporterPoints: snapshot.supporterPointRows.map((row) => ({ name: text(row.name), km: num(row.km) })),
  };
}
