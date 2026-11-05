import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import {
  deliverAdminUserNotification,
  loadAdminUserIdentities,
  loadLatestReplies,
  reviewAppFeedbackWithNotification,
} from "../../../../lib/admin-user-notifications";
import { checkRateLimitAsync, withSecurityHeaders } from "../../../../lib/http";
import { jsonError, requireAdminAuth, serviceHeaders } from "../../../../lib/organizer";

const PAGE_SIZE = 25;
const kindSchema = z.enum(["bug", "feedback"]);
const statusSchema = z.enum(["pending", "completed", "rejected"]);
const feedbackRowSchema = z.object({
  id: z.coerce.number().int().positive(),
  created_at: z.string(),
  user_id: z.string().uuid().nullable(),
  kind: kindSchema,
  source: z.string(),
  screen: z.string().nullable(),
  app_version: z.string().nullable(),
  subject: z.string(),
  detail: z.string(),
  status: statusSchema,
  reviewed_at: z.string().nullable().optional(),
});
// With a notification the status change and the reply are atomic; without one (an author with
// no account, or a silent triage) only the status changes.
const patchSchema = z.object({
  feedbackId: z.coerce.number().int().positive(),
  status: statusSchema,
  notification: z
    .object({
      id: z.string().uuid(),
      title: z.string().trim().min(1).max(160),
      body: z.string().trim().min(1).max(4000),
      sendEmail: z.boolean().optional().default(false),
      sendPush: z.boolean().optional().default(false),
    })
    .optional(),
});

/** The `[bug] ` prefix the clients add to the stored subject, already shown by the tab. */
const cleanSubject = (subject: string) => subject.replace(/^\[(bug|feedback)\]\s*/i, "");

export async function GET(request: NextRequest) {
  const auth = await requireAdminAuth(request);
  if ("error" in auth) return auth.error;

  const kind = kindSchema.safeParse(request.nextUrl.searchParams.get("kind"));
  if (!kind.success) return jsonError("Invalid feedback kind.", 400);
  const page = Math.max(1, Number(request.nextUrl.searchParams.get("page") ?? "1") || 1);
  const statusValue = request.nextUrl.searchParams.get("status") ?? "all";
  const search = (request.nextUrl.searchParams.get("search") ?? "").trim().slice(0, 100).replace(/[,*()]/g, "");
  if (statusValue !== "all" && !statusSchema.safeParse(statusValue).success) {
    return jsonError("Invalid feedback status.", 400);
  }

  const params = new URLSearchParams({
    select: "id,created_at,user_id,kind,source,screen,app_version,subject,detail,status,reviewed_at",
    kind: `eq.${kind.data}`,
    // Still to handle first, handled ones below.
    order: "is_pending.desc,created_at.desc",
    limit: String(PAGE_SIZE),
    offset: String((page - 1) * PAGE_SIZE),
  });
  if (statusValue !== "all") params.set("status", `eq.${statusValue}`);
  if (search) params.set("or", `(subject.ilike.*${search}*,detail.ilike.*${search}*)`);

  const response = await fetch(`${auth.serviceConfig.supabaseUrl}/rest/v1/app_feedback?${params.toString()}`, {
    headers: { ...serviceHeaders(auth.serviceConfig, ""), Prefer: "count=exact" },
    cache: "no-store",
  });
  if (!response.ok) return jsonError("Unable to load feedback.", 502);
  const parsed = z.array(feedbackRowSchema).safeParse(await response.json().catch(() => null));
  if (!parsed.success) return jsonError("Unexpected feedback response.", 500);

  const [{ names, emails }, replies] = await Promise.all([
    loadAdminUserIdentities(auth.serviceConfig, parsed.data.flatMap((row) => (row.user_id ? [row.user_id] : []))),
    loadLatestReplies(auth.serviceConfig, "feedback_id", parsed.data.map((row) => row.id)),
  ]);
  const total = Number(response.headers.get("content-range")?.split("/")[1] ?? parsed.data.length);

  return withSecurityHeaders(NextResponse.json({
    items: parsed.data.map((row) => ({
      id: row.id,
      createdAt: row.created_at,
      userId: row.user_id,
      userEmail: row.user_id ? emails.get(row.user_id) ?? null : null,
      userName: row.user_id ? names.get(row.user_id) ?? null : null,
      kind: row.kind,
      source: row.source,
      screen: row.screen,
      appVersion: row.app_version,
      subject: cleanSubject(row.subject),
      detail: row.detail,
      status: row.status,
      reviewedAt: row.reviewed_at ?? null,
      reply: replies.get(row.id) ?? null,
    })),
    pagination: {
      page,
      pageSize: PAGE_SIZE,
      total,
      totalPages: Math.max(1, Math.ceil(total / PAGE_SIZE)),
    },
  }));
}

export async function PATCH(request: NextRequest) {
  const auth = await requireAdminAuth(request);
  if ("error" in auth) return auth.error;
  const rateLimit = await checkRateLimitAsync(`admin-feedback-review:${auth.user.id}`, 30, 60_000);
  if (!rateLimit.allowed) return jsonError("Too many notification attempts.", 429);

  const parsed = patchSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return jsonError("Invalid feedback review payload.", 400);
  const { feedbackId, status, notification } = parsed.data;

  try {
    if (!notification) {
      const response = await fetch(
        `${auth.serviceConfig.supabaseUrl}/rest/v1/app_feedback?id=eq.${feedbackId}`,
        {
          method: "PATCH",
          headers: { ...serviceHeaders(auth.serviceConfig), Prefer: "return=minimal" },
          body: JSON.stringify({ status, reviewed_at: new Date().toISOString(), reviewed_by: auth.user.id }),
        }
      );
      if (!response.ok) throw new Error(`Unable to update feedback: ${await response.text()}`);
      return withSecurityHeaders(NextResponse.json({ notification: null, delivery: {} }));
    }

    const row = await reviewAppFeedbackWithNotification(auth.serviceConfig, {
      feedbackId,
      adminId: auth.user.id,
      status,
      notificationId: notification.id,
      title: notification.title,
      body: notification.body,
      emailRequested: notification.sendEmail,
      pushRequested: notification.sendPush,
    });
    const delivery = await deliverAdminUserNotification(auth.serviceConfig, row);
    return withSecurityHeaders(NextResponse.json({ notification: row, delivery }));
  } catch (error) {
    console.error("Unable to review feedback", error);
    return jsonError(error instanceof Error ? error.message : "Unable to review feedback.", 502);
  }
}
