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
  { raceId: "76a813fc-f88d-4063-b880-7af0a2f50235", format: "Trail de la Galinette — Les Drailles de la Galinette 50 km" },
  { raceId: "eb20d1e4-c647-452e-80f9-8e5d883b7949", format: "Trail de la Galinette — La Brèche du Mont Julien 30 km" },
  { raceId: "937dda92-73dc-4758-80aa-2124ad9f9e5a", format: "Trail de la Galinette — La Dualinette 24 km" },
  { raceId: "7121c370-004a-4368-a6af-aabdb1f47ade", format: "Trail de la Galinette — La Petite Galinette 12 km" },
  // Checked 2026-11-20: the official GPX downloads without an account (organizer allows it).
  { raceId: "37fbd9cf-9b29-40d9-8811-5cb6c0bbb84e", format: "Trail des Passerelles du Monteynard — La Grande Course 68 km" },
  { raceId: "7f762fc7-94ca-4fd0-8d4a-e884872549c5", format: "Trail des Passerelles du Monteynard — La Grande Course relais à 3" },
  { raceId: "22f51bd7-6494-47be-903e-6b0a51bc35dc", format: "Trail des Passerelles du Monteynard — Maratrail 44 km" },
  { raceId: "3a30b604-c042-4d84-a20a-33b1cf9e20c4", format: "La 6000D — La 6000D 69 km" },
  { raceId: "2079f493-ec93-4c54-b8bd-bcd6f95d12be", format: "La 6000D — La 6000D relais à 3" },
  { raceId: "fa76b94c-9b0c-44bf-a4d7-7bd5eab62c8f", format: "La 6000D — La 6D Marathon 43 km" },
  { raceId: "65da1669-9bce-4e43-b190-919d5ac75596", format: "La 6000D — La 6D Lacs 30 km" },
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
