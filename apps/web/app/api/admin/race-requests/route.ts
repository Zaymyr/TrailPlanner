import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import {
  deliverAdminUserNotification,
  loadAdminUserIdentities,
  loadLatestReplies,
  reviewRaceRequestWithNotification,
} from "../../../../lib/admin-user-notifications";
import { checkRateLimitAsync, withSecurityHeaders } from "../../../../lib/http";
import { jsonError, requireAdminAuth, serviceHeaders } from "../../../../lib/organizer";

const PAGE_SIZE = 25;
const statusSchema = z.enum(["pending", "completed", "rejected"]);
const raceRequestRowSchema = z.object({
  id: z.coerce.number().int().positive(),
  created_at: z.string(),
  updated_at: z.string().optional(),
  user_id: z.string().uuid(),
  race_name: z.string(),
  location: z.string(),
  requested_date: z.string(),
  status: statusSchema,
  reviewed_at: z.string().nullable().optional(),
  reviewed_by: z.string().uuid().nullable().optional(),
});
const patchSchema = z.object({
  requestId: z.coerce.number().int().positive(),
  notificationId: z.string().uuid(),
  status: statusSchema,
  title: z.string().trim().min(1).max(160),
  body: z.string().trim().min(1).max(4000),
  sendEmail: z.boolean().optional().default(false),
  sendPush: z.boolean().optional().default(false),
});
// One-click close ("Clôturer"): the status changes, no message is sent.
const silentPatchSchema = z.object({
  requestId: z.coerce.number().int().positive(),
  status: statusSchema,
  silent: z.literal(true),
});

export async function GET(request: NextRequest) {
  const auth = await requireAdminAuth(request);
  if ("error" in auth) return auth.error;

  const page = Math.max(1, Number(request.nextUrl.searchParams.get("page") ?? "1") || 1);
  const statusValue = request.nextUrl.searchParams.get("status") ?? "all";
  const search = (request.nextUrl.searchParams.get("search") ?? "").trim().slice(0, 100);
  if (statusValue !== "all" && !statusSchema.safeParse(statusValue).success) {
    return jsonError("Invalid race request status.", 400);
  }

  const params = new URLSearchParams({
    select: "id,created_at,updated_at,user_id,race_name,location,requested_date,status,reviewed_at,reviewed_by",
    // Still to handle first, handled ones below.
    order: "is_pending.desc,created_at.desc",
    limit: String(PAGE_SIZE),
    offset: String((page - 1) * PAGE_SIZE),
  });
  if (statusValue !== "all") params.set("status", `eq.${statusValue}`);
  if (search) params.set("or", `(race_name.ilike.*${search.replace(/[,*()]/g, "")}*,location.ilike.*${search.replace(/[,*()]/g, "")}*)`);

  const response = await fetch(`${auth.serviceConfig.supabaseUrl}/rest/v1/race_requests?${params.toString()}`, {
    headers: { ...serviceHeaders(auth.serviceConfig, ""), Prefer: "count=exact" },
    cache: "no-store",
  });
  if (!response.ok) return jsonError("Unable to load race requests.", 502);
  const parsed = z.array(raceRequestRowSchema).safeParse(await response.json().catch(() => null));
  if (!parsed.success) return jsonError("Unexpected race request response.", 500);

  const [{ names, emails }, replies] = await Promise.all([
    loadAdminUserIdentities(auth.serviceConfig, parsed.data.map((row) => row.user_id)),
    loadLatestReplies(auth.serviceConfig, "race_request_id", parsed.data.map((row) => row.id)),
  ]);
  const total = Number(response.headers.get("content-range")?.split("/")[1] ?? parsed.data.length);

  return withSecurityHeaders(NextResponse.json({
    requests: parsed.data.map((row) => ({
      id: row.id,
      createdAt: row.created_at,
      updatedAt: row.updated_at ?? row.created_at,
      userId: row.user_id,
      userEmail: emails.get(row.user_id) ?? null,
      userName: names.get(row.user_id) ?? null,
      raceName: row.race_name,
      location: row.location,
      requestedDate: row.requested_date,
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
  const rateLimit = await checkRateLimitAsync(`admin-race-request-review:${auth.user.id}`, 30, 60_000);
  if (!rateLimit.allowed) return jsonError("Too many notification attempts.", 429);

  const payload = await request.json().catch(() => null);
  const silent = silentPatchSchema.safeParse(payload);
  if (silent.success) {
    const response = await fetch(
      `${auth.serviceConfig.supabaseUrl}/rest/v1/race_requests?id=eq.${silent.data.requestId}`,
      {
        method: "PATCH",
        headers: { ...serviceHeaders(auth.serviceConfig), Prefer: "return=minimal" },
        body: JSON.stringify({ status: silent.data.status, reviewed_at: new Date().toISOString(), reviewed_by: auth.user.id }),
      }
    );
    if (!response.ok) return jsonError("Unable to update race request.", 502);
    return withSecurityHeaders(NextResponse.json({ notification: null, delivery: {} }));
  }

  const parsed = patchSchema.safeParse(payload);
  if (!parsed.success) return jsonError("Invalid race request review payload.", 400);
  try {
    const notification = await reviewRaceRequestWithNotification(auth.serviceConfig, {
      requestId: parsed.data.requestId,
      adminId: auth.user.id,
      status: parsed.data.status,
      notificationId: parsed.data.notificationId,
      title: parsed.data.title,
      body: parsed.data.body,
      emailRequested: parsed.data.sendEmail,
      pushRequested: parsed.data.sendPush,
    });
    const delivery = await deliverAdminUserNotification(auth.serviceConfig, notification);
    return withSecurityHeaders(NextResponse.json({ notification, delivery }));
  } catch (error) {
    console.error("Unable to review race request", error);
    return jsonError(error instanceof Error ? error.message : "Unable to review race request.", 502);
  }
}
