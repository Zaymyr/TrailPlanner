/**
 * Names shown on the map next to the start and finish icons. The start uses the organizer's start
 * place when known; otherwise (and always for the finish) the nearest town or village from the
 * Mapbox Streets place labels. A loop finishes where it starts, so it reuses the start name.
 */
export type EndpointNames = { start: string | null; finish: string | null };

type PlaceFeature = { properties?: { name?: unknown; class?: unknown; tilequery?: { distance?: unknown } } };

// Start and finish this close are one place (a loop, or a finish line next to the start arch).
const SAME_PLACE_METERS = 1_500;
const MAX_NAME_LENGTH = 40;

const shorten = (name: string) => (name.length > MAX_NAME_LENGTH ? `${name.slice(0, MAX_NAME_LENGTH - 1).trimEnd()}…` : name);

/** Nearest settlement (city, town, village, hamlet) within 5 km of a point. */
export const fetchNearestPlaceName = async (lon: number, lat: number, token: string, signal?: AbortSignal) => {
  const url = `https://api.mapbox.com/v4/mapbox.mapbox-streets-v8/tilequery/${lon.toFixed(5)},${lat.toFixed(5)}.json`
    + `?radius=5000&limit=20&layers=place_label&access_token=${encodeURIComponent(token)}`;
  const response = await fetch(url, { signal });
  if (!response.ok) return null;
  const payload = await response.json().catch(() => null) as { features?: PlaceFeature[] } | null;
  const places = (payload?.features ?? [])
    .map((feature) => feature.properties ?? {})
    .filter((properties) => typeof properties.name === "string" && properties.class === "settlement")
    .sort((left, right) => (Number(left.tilequery?.distance) || 0) - (Number(right.tilequery?.distance) || 0));
  const name = places[0]?.name as string | undefined;
  return name ? shorten(name) : null;
};

const distanceMeters = (from: { lat: number; lon: number }, to: { lat: number; lon: number }) => {
  const toRad = (degrees: number) => (degrees * Math.PI) / 180;
  const dLat = toRad(to.lat - from.lat);
  const dLon = toRad(to.lon - from.lon);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(from.lat)) * Math.cos(toRad(to.lat)) * Math.sin(dLon / 2) ** 2;
  return 2 * 6_371_000 * Math.asin(Math.sqrt(a));
};

export const resolveEndpointNames = async (
  start: { lat: number; lon: number },
  finish: { lat: number; lon: number },
  startPlace: string | null | undefined,
  lookup: (lon: number, lat: number) => Promise<string | null>,
): Promise<EndpointNames> => {
  const known = startPlace?.trim() ? shorten(startPlace.trim()) : null;
  const loop = distanceMeters(start, finish) < SAME_PLACE_METERS;
  const [startName, finishName] = await Promise.all([
    known ? Promise.resolve(known) : lookup(start.lon, start.lat).catch(() => null),
    loop ? Promise.resolve(null) : lookup(finish.lon, finish.lat).catch(() => null),
  ]);
  return { start: startName, finish: loop ? startName : finishName };
};
