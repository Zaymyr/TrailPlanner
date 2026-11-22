import { NextRequest, NextResponse } from "next/server";

import { INBOX_FILTERS, loadRecentRenderFailures } from "../../../../lib/admin-inbox-server";
import { withSecurityHeaders } from "../../../../lib/http";
import { jsonError, requireAdminAuth, serviceHeaders } from "../../../../lib/organizer";

/**
 * Pending items per admin inbox entry, for the badges of the console (sidebar, bell, tabs): bugs,
 * feedback, race requests, organizer demo requests, the organizer queues (access claims, publication
 * requests, new-edition requests) and, since lot 2 of the console, the system items of the « À
 * traiter » queue (failed flyovers, failed posts, drafts to review, renders failed in the last 24 h),
 * read with the same filters as `GET /api/admin/inbox` (`lib/admin-inbox-server.ts`).
 * `raceRequests` counts only the runners' race requests; `raceRequestsAndDemos` keeps the former merged total.
 * A system count that cannot be read is `null` (the badge leaves it out) instead of failing every badge.
 */
export async function GET(request: NextRequest) {
  const auth = await requireAdminAuth(request);
  if ("error" in auth) return auth.error;

  const count = async (path: string) => {
    const response = await fetch(`${auth.serviceConfig.supabaseUrl}/rest/v1/${path}&select=id&limit=1`, {
      headers: { ...serviceHeaders(auth.serviceConfig, ""), Prefer: "count=exact" },
      cache: "no-store",
    });
    if (!response.ok) throw new Error(`Unable to count ${path} (${response.status}).`);
    return Number(response.headers.get("content-range")?.split("/")[1] ?? 0) || 0;
  };
  const countPending = (path: string) => count(`${path}&status=eq.pending`);
  const optional = (promise: Promise<number>) => promise.catch((error: unknown) => {
    console.error("Unable to count a system inbox item", error instanceof Error ? error.message : error);
    return null;
  });

  try {
    const [
      [bug, feedback, raceRequests, demoRequests, organizerClaims, publicationRequests, editionRequests],
      [failedFlyovers, failedPosts, draftPosts, failedRenders],
    ] = await Promise.all([
      Promise.all([
        countPending("app_feedback?kind=eq.bug"),
        countPending("app_feedback?kind=eq.feedback"),
        countPending("race_requests?id=not.is.null"),
        // 0 until the table is deployed.
        countPending("organizer_demo_requests?id=not.is.null").catch(() => 0),
        countPending("race_event_claims?id=not.is.null"),
        countPending("race_event_publication_requests?id=not.is.null"),
        countPending("race_event_edition_requests?id=not.is.null"),
      ]),
      Promise.all([
        optional(count(INBOX_FILTERS.failedFlyovers)),
        optional(count(INBOX_FILTERS.failedPosts)),
        optional(count(INBOX_FILTERS.draftPosts)),
        optional(loadRecentRenderFailures(auth.serviceConfig, Date.now()).then((renders) => renders.length)),
      ]),
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
        failedFlyovers,
        failedPosts,
        draftPosts,
        failedRenders,
        systemTotal: (failedFlyovers ?? 0) + (failedPosts ?? 0) + (draftPosts ?? 0) + (failedRenders ?? 0),
      })
    );
  } catch (error) {
    console.error("Unable to count admin inbox", error);
    return jsonError("Unable to count pending messages.", 502);
  }
}
