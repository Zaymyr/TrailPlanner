import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { withSecurityHeaders } from "../../../../../lib/http";
import { jsonError, requireAdminAuth, serviceHeaders } from "../../../../../lib/organizer";
import { publishRacebookSnapshot } from "../../../../../lib/racebook-publications";

const raceSchema = z.object({ id: z.string().uuid() });

/**
 * Deployment-only bridge: populate immutable snapshots after the schema migration
 * and before switching public/mobile reads to the versioned endpoints. It is
 * intentionally idempotent and restricted to a verified app-metadata admin.
 */
export async function POST(request: NextRequest) {
  const auth = await requireAdminAuth(request);
  if ("error" in auth) return auth.error;

  const response = await fetch(
    `${auth.serviceConfig.supabaseUrl}/rest/v1/races?is_live=eq.true&racebook_is_live=eq.true&select=id,racebook_publication_states!inner(current_publication_id)&racebook_publication_states.current_publication_id=is.null`,
    { headers: serviceHeaders(auth.serviceConfig, ""), cache: "no-store" },
  );
  if (!response.ok) return jsonError("Impossible de charger les Livrets coureurs à initialiser.", 502);
  const races = z.array(raceSchema).parse(await response.json());
  const publishedRaceIds: string[] = [];
  const failures: Array<{ raceId: string; message: string }> = [];

  // Sequential publication limits load on the source tables and keeps failures
  // independently retryable without ever replacing an existing publication.
  for (const race of races) {
    try {
      await publishRacebookSnapshot(auth.serviceConfig, race.id, auth.user.id, false);
      publishedRaceIds.push(race.id);
    } catch (error) {
      failures.push({ raceId: race.id, message: error instanceof Error ? error.message : "Unknown publication error" });
    }
  }

  return withSecurityHeaders(NextResponse.json({
    candidateCount: races.length,
    publishedRaceIds,
    failures,
    complete: failures.length === 0,
  }, { status: failures.length === 0 ? 200 : 207 }));
}
