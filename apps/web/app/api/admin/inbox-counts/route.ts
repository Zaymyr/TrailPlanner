import { NextRequest, NextResponse } from "next/server";

import { withSecurityHeaders } from "../../../../lib/http";
import { jsonError, requireAdminAuth, serviceHeaders } from "../../../../lib/organizer";

/** Pending items per admin inbox tab (bugs, feedback, race requests), for the tab badges. */
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
    const [bug, feedback, raceRequests] = await Promise.all([
      countPending("app_feedback?kind=eq.bug"),
      countPending("app_feedback?kind=eq.feedback"),
      countPending("race_requests?id=not.is.null"),
    ]);
    return withSecurityHeaders(NextResponse.json({ bug, feedback, raceRequests }));
  } catch (error) {
    console.error("Unable to count admin inbox", error);
    return jsonError("Unable to count pending messages.", 502);
  }
}
