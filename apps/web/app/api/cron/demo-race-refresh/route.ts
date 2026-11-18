import { NextResponse } from "next/server";

import { DEMO_EDITION_ID, DEMO_EVENT_ID, moveDemoRaceToDay, parisIsoDay } from "../../../../lib/demo-race-refresh";
import { withSecurityHeaders } from "../../../../lib/http";
import { invalidateRacebookCache } from "../../../../lib/racebook-cache";
import { hasBlockingRacebookPublicationIssue } from "../../../../lib/racebook-publication-checks";
import { buildRacebookPublishedSnapshot, loadRacebookPublicationChecks, publishRacebookSnapshot } from "../../../../lib/racebook-publications";
import { getSupabaseServiceConfig } from "../../../../lib/supabase";

export const dynamic = "force-dynamic";

/** Daily: keep the Trail TST demo on today's date and republish its formats. */
export async function GET(request: Request) {
  const cronSecret = process.env.CRON_SECRET?.trim();
  if (!cronSecret || request.headers.get("authorization") !== `Bearer ${cronSecret}`) {
    return withSecurityHeaders(NextResponse.json({ message: "Unauthorized." }, { status: 401 }));
  }
  const config = getSupabaseServiceConfig();
  if (!config) return withSecurityHeaders(NextResponse.json({ message: "Supabase service configuration is missing." }, { status: 500 }));

  try {
    const result = await moveDemoRaceToDay(config, parisIsoDay(new Date()));
    const published: string[] = [];
    const blocked: string[] = [];
    if (result.moved) {
      for (const raceId of result.raceIds) {
        const { snapshot } = await buildRacebookPublishedSnapshot(config, raceId);
        if (hasBlockingRacebookPublicationIssue(await loadRacebookPublicationChecks(config, snapshot))) {
          blocked.push(raceId);
          continue;
        }
        // Automated republication: no human publisher, visibility unchanged.
        await publishRacebookSnapshot(config, raceId, null, false);
        await invalidateRacebookCache({ raceId, editionId: DEMO_EDITION_ID, eventId: DEMO_EVENT_ID });
        published.push(raceId);
      }
    }
    const status = blocked.length > 0 ? 500 : 200;
    if (blocked.length > 0) console.error("Demo race refresh: blocking publication issues", blocked);
    return withSecurityHeaders(NextResponse.json({ ok: status === 200, day: result.day, moved: result.moved, published, blocked }, { status }));
  } catch (error) {
    console.error("Unable to refresh the demo race.", error);
    return withSecurityHeaders(NextResponse.json({ message: "Unable to refresh the demo race." }, { status: 500 }));
  }
}

export const POST = GET;
