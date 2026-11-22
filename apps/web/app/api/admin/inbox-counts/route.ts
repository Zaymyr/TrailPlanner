import { NextRequest, NextResponse } from "next/server";

import { withSecurityHeaders } from "../../../../lib/http";
import { jsonError, requireAdminAuth, serviceHeaders } from "../../../../lib/organizer";

/**
 * Pending items per admin inbox entry, for the tab badges: bugs, feedback, race requests, organizer demo
 * requests, and the organizer queues (access claims, publication requests, new-edition requests).
 * `raceRequests` counts only the runners' race requests; `raceRequestsAndDemos` keeps the former merged total.
 */
export async function GET(request: NextRequest) {
  const auth = await requireAdminAuth(request);
  if ("error" in auth) return auth.error;

  const countPending = async (path: string) => {
    const response = await fetch(`${auth.serviceConfig.supabaseUrl}/rest/v1/${path}&status=eq.pending&select=id&limit=1`, {
      headers: { ...serviceHeaders(auth.serviceConfig, ""), Prefer: "count=exact" },
      cache: "no-store",
    });
    if (!response.ok) throw new Error(`Unable to count ${path} (${response.status}).`);
    return Number(response.headers.get("content-range")?.split("/")[1] ?? 0) || 0;
  };

  try {
    const [bug, feedback, raceRequests, demoRequests, organizerClaims, publicationRequests, editionRequests] = await Promise.all([
      countPending("app_feedback?kind=eq.bug"),
      countPending("app_feedback?kind=eq.feedback"),
      countPending("race_requests?id=not.is.null"),
      // 0 until the table is deployed.
      countPending("organizer_demo_requests?id=not.is.null").catch(() => 0),
      countPending("race_event_claims?id=not.is.null"),
      countPending("race_event_publication_requests?id=not.is.null"),
      countPending("race_event_edition_requests?id=not.is.null"),
    ]);
    return withSecurityHeaders(
      NextResponse.json({
        bug,
        feedback,
        raceRequests,
        demoRequests,
        raceRequestsAndDemos: raceRequests + demoRequests,
        organizerClaims,
        publicationRequests,
        editionRequests,
        organizerTotal: organizerClaims + publicationRequests + editionRequests,
      })
    );
  } catch (error) {
    console.error("Unable to count admin inbox", error);
    return jsonError("Unable to count pending messages.", 502);
  }
}
