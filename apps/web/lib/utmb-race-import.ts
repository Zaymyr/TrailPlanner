import "server-only";

const NEXT_DATA_SCRIPT_PATTERN = /<script[^>]+id=["']__NEXT_DATA__["'][^>]*>(?<json>.*?)<\/script>/is;
const NEXT_DATA_WINDOW_PATTERN = /window\.__NEXT_DATA__\s*=\s*(?<json>\{.*?\})\s*;?/is;
const UTMB_HOST_PATTERN = /(^|\.)utmb\.world$/i;

type UnknownRecord = Record<string, unknown>;

export type UtmbAidStation = {
  name: string;
  distanceKm: number;
  waterRefill: boolean;
};

export type UtmbRaceData = {
  normalizedUrl: string;
  courseName: string;
  eventName: string;
  gpxUrl: string;
  distanceKm: number;
  elevationGainM: number;
  elevationLossM: number;
  date: string | null;
  location: string | null;
  aidStations: UtmbAidStation[];
};

export class UtmbImportError extends Error {
  code: "INVALID_URL" | "FETCH_FAILED" | "INVALID_DATA";

  constructor(code: UtmbImportError["code"], message: string) {
    super(message);
    this.code = code;
  }
}

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function toNonEmptyString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
}

function toFiniteNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number(value.replace(",", "."));
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function metersToKilometers(value: number) {
  return value > 1000 ? value / 1000 : value;
}

function normalizeDate(value: unknown): string | null {
  const stringValue = toNonEmptyString(value);
  if (!stringValue) return null;

  const isoMatch = stringValue.match(/^(\d{4}-\d{2}-\d{2})/);
  if (isoMatch) return isoMatch[1];

  const cleaned = stringValue.replace(/(\d+)(st|nd|rd|th)/gi, "$1");
  const parsed = new Date(cleaned);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toISOString().slice(0, 10);
}

function normalizeComparableName(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/\s+/g, " ");
}

function normalizeUtmbRaceUrl(input: string) {
  let parsed: URL;

  try {
    parsed = new URL(input.trim());
  } catch {
    throw new UtmbImportError("INVALID_URL", "URL UTMB invalide.");
  }

  if (!/^https?:$/i.test(parsed.protocol)) {
    throw new UtmbImportError("INVALID_URL", "URL UTMB invalide.");
  }

  if (!UTMB_HOST_PATTERN.test(parsed.hostname)) {
    throw new UtmbImportError("INVALID_URL", "URL UTMB invalide.");
  }

  if (!/\/races\/[^/]+/i.test(parsed.pathname)) {
    throw new UtmbImportError("INVALID_URL", "URL UTMB invalide.");
  }

  parsed.hash = "";
  parsed.searchParams.sort();
  return parsed.toString();
}

function extractNextDataJson(html: string) {
  const scriptMatch = NEXT_DATA_SCRIPT_PATTERN.exec(html);
  if (scriptMatch?.groups?.json) return scriptMatch.groups.json;

  const windowMatch = NEXT_DATA_WINDOW_PATTERN.exec(html);
  if (windowMatch?.groups?.json) return windowMatch.groups.json;

  throw new UtmbImportError("INVALID_DATA", "Impossible de récupérer les données UTMB pour cette course");
}

function getPageProps(html: string): UnknownRecord {
  const nextData = JSON.parse(extractNextDataJson(html)) as UnknownRecord;
  const props = isRecord(nextData.props) ? nextData.props : null;
  const pageProps = props && isRecord(props.pageProps) ? props.pageProps : null;

  if (!pageProps) {
    throw new UtmbImportError("INVALID_DATA", "Impossible de récupérer les données UTMB pour cette course");
  }

  return pageProps;
}

function getTrackPointAidStations(track: UnknownRecord, totalDistanceKm: number): UtmbAidStation[] {
  const rawPoints = Array.isArray(track.points) ? track.points : [];
  const dedupe = new Set<string>();

  return rawPoints
    .flatMap((point) => {
      if (!isRecord(point)) return [];

      const name = toNonEmptyString(point.name) ?? toNonEmptyString(point.shortName);
      const rawDistance = toFiniteNumber(point.distance);
      const supplies = toNonEmptyString(point.supplies)?.toLowerCase();
      const isAidStation = supplies !== null && supplies !== "none";

      if (!name || rawDistance === null || !isAidStation) return [];

      const distanceKm = Number(metersToKilometers(rawDistance).toFixed(2));
      if (distanceKm <= 0.05 || distanceKm >= totalDistanceKm - 0.05) return [];

      const dedupeKey = `${normalizeComparableName(name)}:${distanceKm.toFixed(2)}`;
      if (dedupe.has(dedupeKey)) return [];
      dedupe.add(dedupeKey);

      return [
        {
          name,
          distanceKm,
          waterRefill: true,
        },
      ];
    })
    .sort((left, right) => left.distanceKm - right.distanceKm);
}

export async function getUtmbRaceData(inputUrl: string): Promise<UtmbRaceData> {
  const normalizedUrl = normalizeUtmbRaceUrl(inputUrl);

  const response = await fetch(normalizedUrl, {
    cache: "no-store",
    headers: {
      "user-agent": "Pace Yourself UTMB Importer",
      accept: "text/html,application/xhtml+xml",
    },
  }).catch(() => null);

  if (!response?.ok) {
    throw new UtmbImportError("FETCH_FAILED", "Impossible de récupérer les données UTMB pour cette course");
  }

  const html = await response.text();
  const pageProps = getPageProps(html);

  const pageHeader = isRecord(pageProps.pageHeader) ? pageProps.pageHeader : {};
  const event = isRecord(pageProps.event) ? pageProps.event : {};
  const track = isRecord(pageProps.track) ? pageProps.track : null;

  const courseName = toNonEmptyString(pageHeader.title);
  const eventName = toNonEmptyString(event.name) ?? courseName;
  const gpxUrl = toNonEmptyString(pageProps.gpxUrl);
  const rawDistance = track ? toFiniteNumber(track.distance) : null;
  const rawGain = track ? toFiniteNumber(track.gainElevation) : null;
  const rawLoss = track ? toFiniteNumber(track.lossElevation) : null;

  if (!courseName || !eventName || !gpxUrl || rawDistance === null || rawGain === null || rawLoss === null || !track) {
    throw new UtmbImportError("INVALID_DATA", "Impossible de récupérer les données UTMB pour cette course");
  }

  const distanceKm = Number(metersToKilometers(rawDistance).toFixed(2));
  const location =
    toNonEmptyString(event.placeName) ??
    toNonEmptyString(pageProps.location) ??
    toNonEmptyString(pageHeader.summary) ??
    eventName;
  const date =
    normalizeDate(pageHeader.startDateIso) ??
    normalizeDate(pageHeader.startDate) ??
    normalizeDate(event.begin) ??
    null;

  return {
    normalizedUrl,
    courseName,
    eventName,
    gpxUrl,
    distanceKm,
    elevationGainM: Math.round(rawGain),
    elevationLossM: Math.round(rawLoss),
    date,
    location,
    aidStations: getTrackPointAidStations(track, distanceKm),
  };
}
