import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { checkRateLimit, withSecurityHeaders } from "../../../lib/http";
import { buildGoogleMapsUrl } from "../../../lib/location-utils";

const searchParamsSchema = z.object({
  q: z.string().trim().min(3).max(120),
  limit: z.coerce.number().int().min(1).max(6).default(5),
  biasLat: z.coerce.number().finite().optional(),
  biasLng: z.coerce.number().finite().optional(),
});

const nominatimRowSchema = z.object({
  display_name: z.string(),
  lat: z.string(),
  lon: z.string(),
  importance: z.coerce.number().nullable().optional(),
  place_rank: z.coerce.number().nullable().optional(),
  class: z.string().nullable().optional(),
  type: z.string().nullable().optional(),
  address: z.record(z.string(), z.string()).nullable().optional(),
});

const photonFeatureSchema = z.object({
  geometry: z.object({ coordinates: z.tuple([z.number(), z.number()]) }),
  properties: z.object({
    name: z.string().nullable().optional(),
    housenumber: z.string().nullable().optional(),
    street: z.string().nullable().optional(),
    postcode: z.string().nullable().optional(),
    city: z.string().nullable().optional(),
    district: z.string().nullable().optional(),
    county: z.string().nullable().optional(),
    state: z.string().nullable().optional(),
    country: z.string().nullable().optional(),
    countrycode: z.string().nullable().optional(),
    osm_key: z.string().nullable().optional(),
    osm_value: z.string().nullable().optional(),
  }),
});

const photonResponseSchema = z.object({ features: z.array(photonFeatureSchema) });

/** One provider-neutral result, scored and deduplicated before the shortlist is returned. */
type LocationCandidate = {
  label: string;
  subtitle: string | null;
  lat: number;
  lng: number;
  /** Provider relevance, roughly 0-1. */
  importance: number;
  /** Bonus from the provider's own notion of precision. */
  kindBonus: number;
  addressParts: string[];
};

const COUNTRY_CODES = ["fr", "mc", "be", "ch", "lu"];
const PHOTON_LANGUAGES = ["fr", "en", "de"];
const USER_AGENT = "PaceYourself/organizer-address-search";

const normalizeSearchText = (value: string) =>
  value
    .toLocaleLowerCase("fr-FR")
    .normalize("NFD")
    .replace(/\p{Diacritic}+/gu, "")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();

const tokenizeSearchText = (value: string) => normalizeSearchText(value).split(/\s+/).filter(Boolean);

const toRadians = (value: number) => (value * Math.PI) / 180;

const calculateDistanceKm = (
  leftLat: number,
  leftLng: number,
  rightLat: number,
  rightLng: number,
) => {
  const earthRadiusKm = 6371;
  const deltaLat = toRadians(rightLat - leftLat);
  const deltaLng = toRadians(rightLng - leftLng);
  const startLat = toRadians(leftLat);
  const endLat = toRadians(rightLat);
  const a =
    Math.sin(deltaLat / 2) ** 2 +
    Math.cos(startLat) * Math.cos(endLat) * Math.sin(deltaLng / 2) ** 2;

  return 2 * earthRadiusKm * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

const scoreSuggestion = (
  query: string,
  candidate: LocationCandidate,
  bias?: { lat: number; lng: number },
) => {
  const normalizedQuery = normalizeSearchText(query);
  const queryTokens = tokenizeSearchText(query);
  const label = normalizeSearchText(candidate.label);
  const subtitle = normalizeSearchText(candidate.subtitle ?? "");
  const addressParts = candidate.addressParts.map((value) => normalizeSearchText(value)).filter(Boolean);

  let score = candidate.importance + candidate.kindBonus;

  if (label.startsWith(normalizedQuery)) score += 8;
  if (label.includes(normalizedQuery)) score += 5;

  queryTokens.forEach((token) => {
    if (label.startsWith(token)) score += 2.5;
    else if (label.includes(token)) score += 1.2;

    if (subtitle === token) score += 0.5;
    if (addressParts.some((part) => part.startsWith(token))) score += 1.5;
  });

  score -= Math.min(label.length / 200, 1);

  if (bias) {
    const distanceKm = calculateDistanceKm(bias.lat, bias.lng, candidate.lat, candidate.lng);

    if (distanceKm <= 5) score += 6;
    else if (distanceKm <= 15) score += 4;
    else if (distanceKm <= 35) score += 2.5;
    else if (distanceKm <= 75) score += 1;
    else score -= Math.min(distanceKm / 120, 3.5);
  }

  return score;
};

const toNominatimCandidate = (row: z.infer<typeof nominatimRowSchema>): LocationCandidate | null => {
  const lat = Number(row.lat);
  const lng = Number(row.lon);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;

  let kindBonus = 0;
  if (row.class === "place" || row.class === "boundary") kindBonus += 0.5;
  if (row.type === "house" || row.type === "residential") kindBonus += 0.3;
  kindBonus += Math.max(0, 2 - Math.abs((row.place_rank ?? 30) - 30) / 10);

  return {
    label: row.display_name,
    subtitle: row.type?.trim() || null,
    lat,
    lng,
    importance: row.importance ?? 0,
    kindBonus,
    addressParts: Object.values(row.address ?? {}),
  };
};

const joinParts = (parts: Array<string | null | undefined>, separator: string) =>
  parts.map((part) => part?.trim()).filter(Boolean).join(separator);

/**
 * Photon returns structured parts: a named place keeps its name first ("Bibracte, Route …, 71990
 * Saint-Léger-sous-Beuvray"), an address starts with its number and street, a town with its county.
 */
const toPhotonCandidate = (feature: z.infer<typeof photonFeatureSchema>, rank: number): LocationCandidate | null => {
  const [lng, lat] = feature.geometry.coordinates;
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;

  const properties = feature.properties;
  const street = joinParts([properties.housenumber, properties.street], " ");
  const locality = joinParts([properties.postcode, properties.city], " ");
  const isTown = properties.osm_key === "place" || properties.osm_key === "boundary";
  const name = properties.name?.trim() && properties.name !== properties.street ? properties.name : null;
  const label = isTown
    ? joinParts([name ?? properties.city, properties.county ?? properties.state, properties.country], ", ")
    : joinParts([name, street, locality, properties.country], ", ");
  if (!label) return null;

  return {
    label,
    subtitle: properties.osm_value?.trim() || null,
    lat,
    lng,
    // Photon lists its results best first, without a score.
    importance: Math.max(0, 0.8 - rank * 0.06),
    kindBonus: (isTown ? 0.5 : 0) + (properties.housenumber ? 1.5 : 0) + (name ? 1.2 : 0),
    addressParts: [properties.name, properties.street, properties.city, properties.district, properties.county, properties.postcode]
      .filter((part): part is string => Boolean(part)),
  };
};

const searchNominatim = async (request: NextRequest, query: string, limit: number) => {
  const upstreamUrl = new URL("https://nominatim.openstreetmap.org/search");
  upstreamUrl.searchParams.set("format", "jsonv2");
  upstreamUrl.searchParams.set("addressdetails", "1");
  upstreamUrl.searchParams.set("namedetails", "1");
  upstreamUrl.searchParams.set("dedupe", "1");
  upstreamUrl.searchParams.set("countrycodes", COUNTRY_CODES.join(","));
  upstreamUrl.searchParams.set("limit", Math.min(limit * 3, 12).toString());
  upstreamUrl.searchParams.set("q", query);

  const response = await fetch(upstreamUrl, {
    headers: {
      Accept: "application/json",
      "Accept-Language": request.headers.get("accept-language") ?? "fr,en;q=0.8",
      "User-Agent": USER_AGENT,
    },
    cache: "no-store",
  });
  if (!response.ok) throw new Error(`Nominatim responded ${response.status}`);

  return z.array(nominatimRowSchema).parse(await response.json())
    .map(toNominatimCandidate)
    .filter((candidate): candidate is LocationCandidate => Boolean(candidate));
};

/** Photon (komoot, OpenStreetMap data) is built for type-ahead: partial words, typos and named places. */
const searchPhoton = async (request: NextRequest, query: string, limit: number, bias?: { lat: number; lng: number }) => {
  const upstreamUrl = new URL("https://photon.komoot.io/api/");
  const language = (request.headers.get("accept-language") ?? "fr").slice(0, 2).toLowerCase();
  upstreamUrl.searchParams.set("q", query);
  upstreamUrl.searchParams.set("limit", Math.min(limit * 3, 15).toString());
  upstreamUrl.searchParams.set("lang", PHOTON_LANGUAGES.includes(language) ? language : "fr");
  if (bias) {
    upstreamUrl.searchParams.set("lat", bias.lat.toString());
    upstreamUrl.searchParams.set("lon", bias.lng.toString());
  }

  const response = await fetch(upstreamUrl, {
    headers: { Accept: "application/json", "User-Agent": USER_AGENT },
    cache: "no-store",
  });
  if (!response.ok) throw new Error(`Photon responded ${response.status}`);

  return photonResponseSchema.parse(await response.json()).features
    // Photon has no country filter: keep France and its neighbours, like the Nominatim search.
    .filter((feature) => COUNTRY_CODES.includes(feature.properties.countrycode?.toLowerCase() ?? ""))
    .map(toPhotonCandidate)
    .filter((candidate): candidate is LocationCandidate => Boolean(candidate));
};

const isSamePlace = (left: LocationCandidate, right: LocationCandidate) =>
  normalizeSearchText(left.label) === normalizeSearchText(right.label) ||
  (calculateDistanceKm(left.lat, left.lng, right.lat, right.lng) < 0.03 &&
    tokenizeSearchText(left.label)[0] === tokenizeSearchText(right.label)[0]);

const getRateLimitKey = (request: NextRequest) =>
  request.headers.get("cf-connecting-ip") ??
  request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
  "unknown";

export async function GET(request: NextRequest) {
  const parsedParams = searchParamsSchema.safeParse({
    q: request.nextUrl.searchParams.get("q"),
    limit: request.nextUrl.searchParams.get("limit") ?? undefined,
    biasLat: request.nextUrl.searchParams.get("biasLat") ?? undefined,
    biasLng: request.nextUrl.searchParams.get("biasLng") ?? undefined,
  });

  if (!parsedParams.success) {
    return withSecurityHeaders(NextResponse.json({ suggestions: [] }, { status: 400 }));
  }

  const rateLimit = checkRateLimit(`location-search:${getRateLimitKey(request)}`, 30, 60_000);
  if (!rateLimit.allowed) {
    return withSecurityHeaders(
      NextResponse.json(
        { suggestions: [], message: "Too many address lookups." },
        {
          status: 429,
          headers: rateLimit.retryAfter ? { "Retry-After": Math.ceil(rateLimit.retryAfter / 1000).toString() } : undefined,
        }
      )
    );
  }

  const { q, limit, biasLat, biasLng } = parsedParams.data;
  const bias = typeof biasLat === "number" && typeof biasLng === "number" ? { lat: biasLat, lng: biasLng } : undefined;

  // Both providers in parallel: Photon finds named places and partial words, Nominatim stays strong
  // on exact postal addresses. Either one failing still returns the other's results.
  const [photon, nominatim] = await Promise.allSettled([
    searchPhoton(request, q, limit, bias),
    searchNominatim(request, q, limit),
  ]);

  if (photon.status === "rejected" && nominatim.status === "rejected") {
    console.error("Unable to search addresses", photon.reason, nominatim.reason);
    return withSecurityHeaders(NextResponse.json({ suggestions: [] }, { status: 502 }));
  }
  if (photon.status === "rejected") console.warn("Photon address search failed", photon.reason);
  if (nominatim.status === "rejected") console.warn("Nominatim address search failed", nominatim.reason);

  const ranked = [
    ...(photon.status === "fulfilled" ? photon.value : []),
    ...(nominatim.status === "fulfilled" ? nominatim.value : []),
  ]
    .map((candidate) => ({ candidate, score: scoreSuggestion(q, candidate, bias) }))
    .sort((left, right) => right.score - left.score)
    .map(({ candidate }) => candidate);

  const suggestions = ranked
    // The same place from both providers keeps only its best-ranked entry.
    .filter((candidate, index) => ranked.findIndex((other) => isSamePlace(other, candidate)) === index)
    .slice(0, limit)
    .map((candidate) => ({
      label: candidate.label,
      lat: Number(candidate.lat.toFixed(6)),
      lng: Number(candidate.lng.toFixed(6)),
      googleMapsUrl: buildGoogleMapsUrl({ label: candidate.label, lat: candidate.lat, lng: candidate.lng }),
      subtitle: candidate.subtitle,
    }));

  return withSecurityHeaders(NextResponse.json({ suggestions }));
}
