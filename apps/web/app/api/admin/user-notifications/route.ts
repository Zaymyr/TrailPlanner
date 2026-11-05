import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import {
  deliverAdminUserNotification,
  fetchAdminAuthUser,
  insertAdminUserNotification,
} from "../../../../lib/admin-user-notifications";
import { checkRateLimitAsync, withSecurityHeaders } from "../../../../lib/http";
import { jsonError, requireAdminAuth } from "../../../../lib/organizer";

const createSchema = z.object({
  notificationId: z.string().uuid(),
  userId: z.string().uuid(),
  title: z.string().trim().min(1).max(160),
  body: z.string().trim().min(1).max(4000),
  sendEmail: z.boolean().optional().default(false),
  sendPush: z.boolean().optional().default(false),
});

export async function POST(request: NextRequest) {
  const auth = await requireAdminAuth(request);
  if ("error" in auth) return auth.error;
  const rateLimit = await checkRateLimitAsync(`admin-user-notification:${auth.user.id}`, 30, 60_000);
  if (!rateLimit.allowed) return jsonError("Too many notification attempts.", 429);
  const parsed = createSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return jsonError("Invalid notification payload.", 400);

  try {
    const target = await fetchAdminAuthUser(auth.serviceConfig, parsed.data.userId);
    if (!target) return jsonError("User not found.", 404);
    const notification = await insertAdminUserNotification(auth.serviceConfig, {
      id: parsed.data.notificationId,
      userId: parsed.data.userId,
      adminId: auth.user.id,
      title: parsed.data.title,
      body: parsed.data.body,
      emailRequested: parsed.data.sendEmail,
      pushRequested: parsed.data.sendPush,
    });
    const delivery = await deliverAdminUserNotification(auth.serviceConfig, notification);
    return withSecurityHeaders(NextResponse.json({ notification, delivery }, { status: 201 }));
  } catch (error) {
    console.error("Unable to create admin user notification", error);
    return jsonError(error instanceof Error ? error.message : "Unable to create notification.", 502);
  }
}
