import { createHash, timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";

import { withSecurityHeaders } from "../../../../../../lib/http";
import { getSupabaseServiceConfig } from "../../../../../../lib/supabase";
import {
  enrichExistingRaceWithTraceDeTrailGpx,
  TraceDeTrailEnrichmentError,
} from "../../../../../../lib/tracedetrail-gpx-enrichment";

export const maxDuration = 300;

const requestSchema = z.object({
  raceIds: z.array(z.string().uuid()).min(1).max(50).transform((values) => [...new Set(values)]),
});

const secureEqual = (left: string, right: string) => {
  const leftDigest = createHash("sha256").update(left).digest();
  const rightDigest = createHash("sha256").update(right).digest();
  return timingSafeEqual(leftDigest, rightDigest);
};

const isAuthorized = (request: Request, secret: string) => {
  const authorization = request.headers.get("authorization") ?? "";
  const prefix = "Bearer ";
  if (!authorization.startsWith(prefix)) return false;
  return secureEqual(authorization.slice(prefix.length), secret);
};

export async function POST(request: Request) {
  const secret = process.env.TRACEDETRAIL_ENRICHMENT_SECRET?.trim();
  if (!secret) {
    return withSecurityHeaders(
      NextResponse.json({ message: "Trace de Trail automation is not configured." }, { status: 503 })
    );
  }
  if (!isAuthorized(request, secret)) {
    return withSecurityHeaders(NextResponse.json({ message: "Unauthorized." }, { status: 401 }));
  }

  const serviceConfig = getSupabaseServiceConfig();
  if (!serviceConfig) {
    return withSecurityHeaders(
      NextResponse.json({ message: "Supabase configuration is missing." }, { status: 500 })
    );
  }

  const parsed = requestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return withSecurityHeaders(NextResponse.json({ message: "Invalid request." }, { status: 400 }));
  }

  const login = process.env.TRACEDETRAIL_LOGIN?.trim();
  const password = process.env.TRACEDETRAIL_PASSWORD;
  if ((login && !password) || (!login && password)) {
    return withSecurityHeaders(
      NextResponse.json({ message: "Trace de Trail credentials are incomplete." }, { status: 500 })
    );
  }
  const credentials = login && password ? { login, password } : null;

  const results = [];
  for (const raceId of parsed.data.raceIds) {
    try {
      const result = await enrichExistingRaceWithTraceDeTrailGpx({ serviceConfig, raceId, credentials });
      results.push({ raceId, ok: true as const, ...result });
    } catch (error) {
      if (error instanceof TraceDeTrailEnrichmentError) {
        results.push({
          raceId,
          ok: false as const,
          code: error.code,
          message: error.message,
        });
        continue;
      }
      console.error("Unexpected automated Trace de Trail enrichment failure", { raceId, error });
      results.push({
        raceId,
        ok: false as const,
        code: "UNEXPECTED_ERROR" as const,
        message: "Unexpected enrichment failure.",
      });
    }
  }

  const imported = results.filter((result) => result.ok && result.enriched).length;
  const unchanged = results.filter((result) => result.ok && result.unchanged).length;
  const failed = results.length - imported - unchanged;

  return withSecurityHeaders(
    NextResponse.json({
      ok: failed === 0,
      summary: { requested: results.length, imported, unchanged, failed },
      results,
    })
  );
}
