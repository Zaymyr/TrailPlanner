import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { checkRateLimit, withSecurityHeaders } from "../../../lib/http";
import { buildGoogleMapsUrl } from "../../../lib/location-utils";

const searchParamsSchema = z.object({
  q: z.string().trim().min(3).max(120),
  limit: z.coerce.number().int().min(1).max(6).default(5),
});

const nominatimRowSchema = z.object({
  display_name: z.string(),
  lat: z.string(),
  lon: z.string(),
  type: z.string().nullable().optional(),
});

const getRateLimitKey = (request: NextRequest) =>
  request.headers.get("cf-connecting-ip") ??
  request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
  "unknown";

export async function GET(request: NextRequest) {
  const parsedParams = searchParamsSchema.safeParse({
    q: request.nextUrl.searchParams.get("q"),
    limit: request.nextUrl.searchParams.get("limit") ?? undefined,
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
  upstreamUrl.searchParams.set("limit", parsedParams.data.limit.toString());
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
          label: row.display_name,
          lat: Number(lat.toFixed(6)),
          lng: Number(lng.toFixed(6)),
          googleMapsUrl: buildGoogleMapsUrl({ label: row.display_name, lat, lng }),
          subtitle: row.type?.trim() || null,
        };
      })
      .filter((suggestion): suggestion is NonNullable<typeof suggestion> => Boolean(suggestion));

    return withSecurityHeaders(NextResponse.json({ suggestions }));
  } catch (error) {
    console.error("Unable to search addresses", error);
    return withSecurityHeaders(NextResponse.json({ suggestions: [] }, { status: 502 }));
  }
}
