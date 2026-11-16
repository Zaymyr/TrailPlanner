import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import {
  estimateCourseTime,
  flatPaceFromUtmbIndex,
  isValidFlatPace,
} from "../../(planner)/race-planner/utils/quick-estimate";
import { checkRateLimit, withSecurityHeaders } from "../../../lib/http";
import { getPublicRaceDetail } from "../../../lib/public-race-detail";
import { getPublicRaces } from "../../../lib/public-races";

const bodySchema = z
  .object({
    catalogRaceId: z.string().uuid(),
    flatPaceMinPerKm: z.number().finite().nullable().optional(),
    utmbIndex: z.number().finite().nullable().optional(),
  })
  .refine((body) => isValidFlatPace(body.flatPaceMinPerKm) || (typeof body.utmbIndex === "number" && body.utmbIndex > 0), {
    message: "A comfortable flat pace or a UTMB index is required.",
  });

const json = (body: unknown, status = 200) => withSecurityHeaders(NextResponse.json(body, { status }));

/**
 * Account-free estimate for a web-public catalog race. Only aggregated times
 * leave the server: the private GPX and its preview points stay here.
 */
export async function POST(request: NextRequest) {
  const rateLimitKey = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const rateLimit = checkRateLimit(`race-estimate:${rateLimitKey}`, 20, 60_000);
  if (!rateLimit.allowed) return json({ message: "Too many requests." }, 429);

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return json({ message: "Invalid request." }, 400);
  const { catalogRaceId, flatPaceMinPerKm, utmbIndex } = parsed.data;

  const race = (await getPublicRaces()).find((candidate) => candidate.id === catalogRaceId);
  if (!race) return json({ message: "Race not found." }, 404);
  const detail = await getPublicRaceDetail(race);
  if (!detail) return json({ message: "Race not found." }, 404);

  const course = {
    distanceKm: detail.distanceKm,
    elevationGainM: detail.elevationGainM,
    elevationLossM: detail.elevationLossM ?? detail.routePreview?.stats.lossM ?? null,
    points: detail.routePreview?.points ?? null,
    aidStations: detail.aidStations.map((station) => ({ name: station.name, distanceKm: station.distanceKm })),
  };

  const utmbPace = typeof utmbIndex === "number" ? flatPaceFromUtmbIndex(utmbIndex) : null;
  const fromPace = isValidFlatPace(flatPaceMinPerKm) ? estimateCourseTime(course, flatPaceMinPerKm) : null;
  const fromUtmb = utmbPace !== null ? estimateCourseTime(course, utmbPace) : null;
  if (!fromPace && !fromUtmb) return json({ message: "This race cannot be estimated yet." }, 422);

  return json({
    race: { id: detail.id, name: detail.name, slug: detail.slug, distanceKm: detail.distanceKm, elevationGainM: detail.elevationGainM },
    fromPace,
    fromUtmb: fromUtmb ? { ...fromUtmb, utmbIndex } : null,
  });
}
