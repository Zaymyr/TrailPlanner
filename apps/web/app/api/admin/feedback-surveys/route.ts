import { withAdminAudit, auditBody } from "../../../../lib/admin-audit-log";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import {
  FeedbackSurveyAudienceError,
  loadSurveyCampaigns,
  sendRacebookSurvey,
  surveySendSchema,
} from "../../../../lib/feedback-surveys";
import { checkRateLimitAsync, withSecurityHeaders } from "../../../../lib/http";
import { jsonError, requireAdminAuth, serviceHeaders } from "../../../../lib/organizer";
import type { SupabaseServiceConfig } from "../../../../lib/supabase";

// A campaign reaches a few hundred runners; push delivery runs in this request.
export const maxDuration = 300;

const profileRowSchema = z.object({ user_id: z.string().uuid(), full_name: z.string().nullable() });

async function loadProfileNames(serviceConfig: SupabaseServiceConfig, userIds: string[]) {
  const ids = [...new Set(userIds)];
  if (ids.length === 0) return new Map<string, string | null>();
  const params = new URLSearchParams({ select: "user_id,full_name", user_id: `in.(${ids.join(",")})` });
  const response = await fetch(`${serviceConfig.supabaseUrl}/rest/v1/user_profiles?${params.toString()}`, {
    headers: serviceHeaders(serviceConfig, ""),
    cache: "no-store",
  });
  if (!response.ok) return new Map<string, string | null>();
  const parsed = z.array(profileRowSchema).safeParse(await response.json().catch(() => null));
  return new Map((parsed.success ? parsed.data : []).map((row) => [row.user_id, row.full_name]));
}

export async function GET(request: NextRequest) {
  const auth = await requireAdminAuth(request);
  if ("error" in auth) return auth.error;

  try {
    const campaigns = await loadSurveyCampaigns(auth.serviceConfig);
    const names = await loadProfileNames(
      auth.serviceConfig,
      campaigns.flatMap((campaign) => campaign.responses.map((response) => response.user_id))
    );
    return withSecurityHeaders(
      NextResponse.json({
        campaigns: campaigns.map((campaign) => ({
          ...campaign,
          responses: campaign.responses.map((response) => ({
            id: response.id,
            userId: response.user_id,
            userName: names.get(response.user_id) ?? null,
            foundUseful: response.found_useful,
            usefulText: response.useful_text,
            missingText: response.missing_text,
            appVersion: response.app_version,
            platform: response.platform,
            createdAt: response.created_at,
          })),
        })),
      })
    );
  } catch (error) {
    console.error("Unable to load feedback surveys", error);
    return jsonError("Unable to load feedback surveys.", 502);
  }
}

async function postRoute(request: NextRequest) {
  const auth = await requireAdminAuth(request);
  if ("error" in auth) return auth.error;
  const rateLimit = await checkRateLimitAsync(`admin-feedback-survey:${auth.user.id}`, 5, 60_000);
  if (!rateLimit.allowed) return jsonError("Too many survey sends.", 429);
  const parsed = surveySendSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return jsonError("Invalid survey payload.", 400);

  try {
    const result = await sendRacebookSurvey(auth.serviceConfig, { ...parsed.data, adminId: auth.user.id });
    return withSecurityHeaders(NextResponse.json(result, { status: 201 }));
  } catch (error) {
    console.error("Unable to send feedback survey", error);
    if (error instanceof FeedbackSurveyAudienceError) {
      return jsonError(
        error.reason === "configuration" ? "PostHog API is not configured on this environment." : error.message,
        502
      );
    }
    return jsonError(error instanceof Error ? error.message : "Unable to send survey.", 502);
  }
}

export const POST = withAdminAudit(postRoute, {
  action: "survey.send",
  targetType: "survey",
  targetId: (c) => auditBody(c).campaignId as string | undefined,
  summary: (c) => `Questionnaire envoyé ${auditBody(c).userId ? "à un coureur" : "aux coureurs d’une édition"}`,
  after: (c) => ({
    campaignId: auditBody(c).campaignId,
    eventId: auditBody(c).eventId ?? null,
    scope: auditBody(c).userId ? "coureur" : "édition",
    email: Boolean(auditBody(c).sendEmail),
    push: auditBody(c).sendPush !== false,
  }),
});
