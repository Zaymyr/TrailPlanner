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

const COUNTRY_CODES = ["fr", "mc", "be", "ch", "lu"];

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
  row: z.infer<typeof nominatimRowSchema>,
  options?: {
    biasLat?: number;
    biasLng?: number;
  },
) => {
  const normalizedQuery = normalizeSearchText(query);
  const queryTokens = tokenizeSearchText(query);
  const label = normalizeSearchText(row.display_name);
  const subtitle = normalizeSearchText(row.type ?? "");
  const addressParts = Object.values(row.address ?? {}).map((value) => normalizeSearchText(value)).filter(Boolean);

  let score = row.importance ?? 0;

  if (label.startsWith(normalizedQuery)) score += 8;
  if (label.includes(normalizedQuery)) score += 5;

  queryTokens.forEach((token) => {
    if (label.startsWith(token)) score += 2.5;
    else if (label.includes(token)) score += 1.2;

    if (subtitle === token) score += 0.5;
    if (addressParts.some((part) => part.startsWith(token))) score += 1.5;
  });

  if (row.class === "place" || row.class === "boundary") score += 0.5;
  if (row.type === "house" || row.type === "residential") score += 0.3;

  const placeRank = row.place_rank ?? 30;
  score += Math.max(0, 2 - Math.abs(placeRank - 30) / 10);
  score -= Math.min(label.length / 200, 1);

  if (typeof options?.biasLat === "number" && typeof options?.biasLng === "number") {
    const rowLat = Number(row.lat);
    const rowLng = Number(row.lon);

    if (Number.isFinite(rowLat) && Number.isFinite(rowLng)) {
      const distanceKm = calculateDistanceKm(options.biasLat, options.biasLng, rowLat, rowLng);

      if (distanceKm <= 5) score += 6;
      else if (distanceKm <= 15) score += 4;
      else if (distanceKm <= 35) score += 2.5;
      else if (distanceKm <= 75) score += 1;
      else score -= Math.min(distanceKm / 120, 3.5);
    }
  }

  return score;
};

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

  const upstreamUrl = new URL("https://nominatim.openstreetmap.org/search");
  upstreamUrl.searchParams.set("format", "jsonv2");
  upstreamUrl.searchParams.set("addressdetails", "1");
  upstreamUrl.searchParams.set("namedetails", "1");
  upstreamUrl.searchParams.set("dedupe", "1");
  upstreamUrl.searchParams.set("countrycodes", COUNTRY_CODES.join(","));
  upstreamUrl.searchParams.set("limit", Math.min(parsedParams.data.limit * 3, 12).toString());
  upstreamUrl.searchParams.set("q", parsedParams.data.q);

  try {
    const response = await fetch(upstreamUrl, {
      headers: {
        Accept: "application/json",
        "Accept-Language": request.headers.get("accept-language") ?? "fr,en;q=0.8",
        "User-Agent": "PaceYourself/organizer-address-search",
      },
      cache: "no-store",
    });

    if (!response.ok) {
      return withSecurityHeaders(NextResponse.json({ suggestions: [] }, { status: 502 }));
    }

    const rows = z.array(nominatimRowSchema).parse(await response.json());
    const suggestions = rows
      .map((row) => {
        const lat = Number(row.lat);
        const lng = Number(row.lon);
        if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;

        return {
          score: scoreSuggestion(parsedParams.data.q, row, {
            biasLat: parsedParams.data.biasLat,
            biasLng: parsedParams.data.biasLng,
          }),
          label: row.display_name,
          lat: Number(lat.toFixed(6)),
          lng: Number(lng.toFixed(6)),
          googleMapsUrl: buildGoogleMapsUrl({ label: row.display_name, lat, lng }),
          subtitle: row.type?.trim() || null,
        };
      })
      .filter((suggestion): suggestion is NonNullable<typeof suggestion> => Boolean(suggestion))
      .sort((left, right) => right.score - left.score)
      .filter((suggestion, index, collection) => collection.findIndex((item) => item.label === suggestion.label) === index)
      .slice(0, parsedParams.data.limit)
      .map(({ score: _score, ...suggestion }) => suggestion);

    return withSecurityHeaders(NextResponse.json({ suggestions }));
  } catch (error) {
    console.error("Unable to search addresses", error);
    return withSecurityHeaders(NextResponse.json({ suggestions: [] }, { status: 502 }));
  }
}
