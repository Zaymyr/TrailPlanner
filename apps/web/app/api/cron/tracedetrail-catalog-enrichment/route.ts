import { NextResponse } from "next/server";

import { withSecurityHeaders } from "../../../../lib/http";

export const maxDuration = 300;

const enrichmentPath = "/api/internal/race-catalog/tracedetrail/enrich";

// This reviewed allowlist is intentionally narrower than every catalog row carrying a
// Trace de Trail id. Expanding it requires confirming that the organizer permits the
// official GPX download; the internal service still rejects embedded-only geometry.
const scheduledFormats = [
  { raceId: "703eaeb0-5ec5-4e3d-bd2b-939afe25ad17", format: "Trace des Maquisards — 100 km" },
  { raceId: "2883746f-099d-4a88-bda2-66cd513ceab6", format: "Trace des Maquisards — 65 km" },
  { raceId: "3a9b9aab-9784-45f8-acc6-5e4abc50c427", format: "Trace des Maquisards — 42 km" },
  { raceId: "9d4fb6cc-e6c9-4c43-b821-e78b5d5ba4ad", format: "Trace des Maquisards — 30 km" },
  { raceId: "eb91d0cd-493b-412e-94a9-499a7872697e", format: "Trace des Maquisards — 18 km" },
  { raceId: "dddc05d4-3ef9-4b53-952f-9ea6b791ce76", format: "Trace des Maquisards — 7 km" },
] as const;

type EnrichmentResult = {
  raceId: string;
  status?: "imported" | "unchanged" | "error";
  [key: string]: unknown;
};

type EnrichmentResponse = {
  ok: boolean;
  summary: { requested: number; imported: number; unchanged: number; failed: number };
  results: EnrichmentResult[];
};

const isEnrichmentResponse = (value: unknown): value is EnrichmentResponse => {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<EnrichmentResponse>;
  return typeof candidate.ok === "boolean" && Array.isArray(candidate.results) && !!candidate.summary;
};

export async function GET(request: Request) {
  const cronSecret = process.env.CRON_SECRET?.trim();
  if (!cronSecret || request.headers.get("authorization") !== `Bearer ${cronSecret}`) {
    return withSecurityHeaders(NextResponse.json({ message: "Unauthorized." }, { status: 401 }));
  }

  const enrichmentSecret = process.env.TRACEDETRAIL_ENRICHMENT_SECRET?.trim();
  if (!enrichmentSecret) {
    return withSecurityHeaders(
      NextResponse.json({ message: "Trace de Trail automation is not configured." }, { status: 503 })
    );
  }

  try {
    const response = await fetch(new URL(enrichmentPath, request.url), {
      method: "POST",
      headers: {
        authorization: `Bearer ${enrichmentSecret}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({ raceIds: scheduledFormats.map(({ raceId }) => raceId) }),
      cache: "no-store",
      redirect: "error",
    });
    const payload: unknown = await response.json().catch(() => null);

    if (!response.ok || !isEnrichmentResponse(payload)) {
      console.error("Trace de Trail enrichment service returned an invalid response", {
        status: response.status,
      });
      return withSecurityHeaders(
        NextResponse.json({ message: "Trace de Trail enrichment service failed." }, { status: 502 })
      );
    }

    const formatsById = new Map<string, string>(
      scheduledFormats.map((target) => [target.raceId, target.format])
    );
    return withSecurityHeaders(
      NextResponse.json({
        ok: payload.ok,
        summary: payload.summary,
        results: payload.results.map((result) => ({
          ...result,
          format: formatsById.get(result.raceId) ?? result.raceId,
        })),
      })
    );
  } catch (error) {
    console.error("Unable to run scheduled Trace de Trail catalog enrichment", error);
    return withSecurityHeaders(
      NextResponse.json({ message: "Trace de Trail enrichment service failed." }, { status: 502 })
    );
  }
}

export const POST = GET;
