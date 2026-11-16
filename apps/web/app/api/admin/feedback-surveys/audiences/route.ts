import { NextRequest, NextResponse } from "next/server";

import {
  FeedbackSurveyAudienceError,
  loadRacebookAudiences,
  previewRacebookAudience,
  surveyEventIdSchema,
} from "../../../../../lib/feedback-surveys";
import { withSecurityHeaders } from "../../../../../lib/http";
import { jsonError, requireAdminAuth } from "../../../../../lib/organizer";

/**
 * Without `eventId`: the events whose livret coureur was opened in the last year, with their reader
 * counts. With `eventId`: how many of that event's readers a survey can reach (account, push, email).
 */
export async function GET(request: NextRequest) {
  const auth = await requireAdminAuth(request);
  if ("error" in auth) return auth.error;

  const rawEventId = request.nextUrl.searchParams.get("eventId");
  try {
    if (rawEventId === null) {
      return withSecurityHeaders(NextResponse.json({ audiences: await loadRacebookAudiences() }));
    }
    const eventId = surveyEventIdSchema.safeParse(rawEventId);
    if (!eventId.success) return jsonError("Invalid event id.", 400);
    return withSecurityHeaders(
      NextResponse.json({ preview: await previewRacebookAudience(auth.serviceConfig, eventId.data) })
    );
  } catch (error) {
    console.error("Unable to load survey audience", error);
    if (error instanceof FeedbackSurveyAudienceError && error.reason === "configuration") {
      return jsonError("PostHog API is not configured on this environment.", 503);
    }
    return jsonError("Unable to load survey audience.", 502);
  }
}
