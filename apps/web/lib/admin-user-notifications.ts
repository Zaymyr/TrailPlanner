import { z } from "zod";

import { serviceHeaders } from "./organizer";
import { sendAdminUserNotificationPush } from "./push";
import { sendAdminUserNotificationEmail } from "./resend";
import type { SupabaseServiceConfig } from "./supabase";

export const adminNotificationKindSchema = z.enum(["admin_message", "race_request_status"]);
export const adminNotificationDeliveryStatusSchema = z.enum([
  "not_requested",
  "pending",
  "sent",
  "failed",
  "unavailable",
]);

export const adminUserNotificationRowSchema = z.object({
  id: z.string().uuid(),
  user_id: z.string().uuid(),
  created_by: z.string().uuid().nullable().optional(),
  race_request_id: z.coerce.number().int().positive().nullable().optional(),
  feedback_id: z.coerce.number().int().positive().nullable().optional(),
  kind: adminNotificationKindSchema,
  title: z.string(),
  body: z.string(),
  read_at: z.string().nullable().optional(),
  deleted_at: z.string().nullable().optional(),
  email_requested: z.boolean(),
  email_status: adminNotificationDeliveryStatusSchema,
  email_provider_id: z.string().nullable().optional(),
  email_error: z.string().nullable().optional(),
  push_requested: z.boolean(),
  push_status: adminNotificationDeliveryStatusSchema,
  push_sent_count: z.coerce.number().int().nonnegative(),
  push_error: z.string().nullable().optional(),
  created_at: z.string(),
  updated_at: z.string().optional(),
});

export type AdminUserNotificationRow = z.infer<typeof adminUserNotificationRowSchema>;

const authUserSchema = z.object({
  id: z.string().uuid(),
  email: z.string().nullable().optional(),
});

const parseNotification = (payload: unknown): AdminUserNotificationRow => {
  const candidate = Array.isArray(payload) ? payload[0] : payload;
  return adminUserNotificationRowSchema.parse(candidate);
};

export async function fetchAdminAuthUser(
  serviceConfig: SupabaseServiceConfig,
  userId: string
): Promise<z.infer<typeof authUserSchema> | null> {
  const response = await fetch(`${serviceConfig.supabaseUrl}/auth/v1/admin/users/${encodeURIComponent(userId)}`, {
    headers: serviceHeaders(serviceConfig, ""),
    cache: "no-store",
  });
  if (response.status === 404) return null;
  if (!response.ok) throw new Error(`Unable to load Auth user (${response.status}).`);
  return authUserSchema.parse(await response.json());
}

/** Display name (user_profiles) and Auth email of each user, for the admin inbox lists. */
export async function loadAdminUserIdentities(serviceConfig: SupabaseServiceConfig, userIds: string[]) {
  const ids = [...new Set(userIds)];
  if (ids.length === 0) return { names: new Map<string, string | null>(), emails: new Map<string, string | null>() };
  const profileParams = new URLSearchParams({ select: "user_id,full_name", user_id: `in.(${ids.join(",")})` });
  const [profiles, authUsers] = await Promise.all([
    fetch(`${serviceConfig.supabaseUrl}/rest/v1/user_profiles?${profileParams.toString()}`, {
      headers: serviceHeaders(serviceConfig, ""),
      cache: "no-store",
    }).then(async (response) => (response.ok ? response.json() : [])) as Promise<Array<{ user_id: string; full_name: string | null }>>,
    Promise.all(ids.map((userId) => fetchAdminAuthUser(serviceConfig, userId).catch(() => null))),
  ]);
  return {
    names: new Map(profiles.map((profile) => [profile.user_id, profile.full_name])),
    emails: new Map(authUsers.filter((user): user is NonNullable<typeof user> => Boolean(user)).map((user) => [user.id, user.email ?? null])),
  };
}

const latestReplyRowSchema = z.object({
  feedback_id: z.coerce.number().int().positive().nullable().optional(),
  race_request_id: z.coerce.number().int().positive().nullable().optional(),
  title: z.string(),
  body: z.string(),
  created_at: z.string(),
  read_at: z.string().nullable(),
  deleted_at: z.string().nullable(),
});

export type AdminLatestReply = {
  title: string;
  body: string;
  sentAt: string;
  readAt: string | null;
  deletedAt: string | null;
};

/** The last message sent about each bug, feedback or race request, with its read and deletion state. */
export async function loadLatestReplies(
  serviceConfig: SupabaseServiceConfig,
  column: "feedback_id" | "race_request_id",
  ids: number[]
): Promise<Map<number, AdminLatestReply>> {
  const replies = new Map<number, AdminLatestReply>();
  if (ids.length === 0) return replies;
  const params = new URLSearchParams({
    select: `${column},title,body,created_at,read_at,deleted_at`,
    [column]: `in.(${[...new Set(ids)].join(",")})`,
    order: "created_at.desc",
  });
  const response = await fetch(`${serviceConfig.supabaseUrl}/rest/v1/user_notifications?${params.toString()}`, {
    headers: serviceHeaders(serviceConfig, ""),
    cache: "no-store",
  });
  if (!response.ok) return replies;
  const parsed = z.array(latestReplyRowSchema).safeParse(await response.json().catch(() => null));
  if (!parsed.success) return replies;
  for (const row of parsed.data) {
    const id = row[column];
    if (!id || replies.has(id)) continue;
    replies.set(id, { title: row.title, body: row.body, sentAt: row.created_at, readAt: row.read_at, deletedAt: row.deleted_at });
  }
  return replies;
}

export async function insertAdminUserNotification(
  serviceConfig: SupabaseServiceConfig,
  input: {
    id: string;
    userId: string;
    adminId: string;
    title: string;
    body: string;
    emailRequested: boolean;
    pushRequested: boolean;
  }
): Promise<AdminUserNotificationRow> {
  const response = await fetch(`${serviceConfig.supabaseUrl}/rest/v1/user_notifications?on_conflict=id`, {
    method: "POST",
    headers: {
      ...serviceHeaders(serviceConfig),
      Prefer: "resolution=ignore-duplicates,return=representation",
    },
    body: JSON.stringify({
      id: input.id,
      user_id: input.userId,
      created_by: input.adminId,
      kind: "admin_message",
      title: input.title,
      body: input.body,
      email_requested: input.emailRequested,
      email_status: input.emailRequested ? "pending" : "not_requested",
      push_requested: input.pushRequested,
      push_status: input.pushRequested ? "pending" : "not_requested",
    }),
  });
  if (!response.ok) throw new Error(`Unable to create user notification: ${await response.text()}`);
  const inserted = (await response.json().catch(() => null)) as unknown;
  if (Array.isArray(inserted) && inserted.length > 0) return parseNotification(inserted);

  const existingResponse = await fetch(
    `${serviceConfig.supabaseUrl}/rest/v1/user_notifications?id=eq.${encodeURIComponent(input.id)}&select=*&limit=1`,
    { headers: serviceHeaders(serviceConfig, ""), cache: "no-store" }
  );
  if (!existingResponse.ok) throw new Error("Unable to load existing user notification.");
  const existing = parseNotification(await existingResponse.json());
  if (
    existing.user_id !== input.userId
    || existing.created_by !== input.adminId
    || existing.kind !== "admin_message"
    || existing.title !== input.title
    || existing.body !== input.body
    || existing.email_requested !== input.emailRequested
    || existing.push_requested !== input.pushRequested
  ) {
    throw new Error("Notification id is already used by a different message.");
  }
  return existing;
}

export async function reviewRaceRequestWithNotification(
  serviceConfig: SupabaseServiceConfig,
  input: {
    requestId: number;
    adminId: string;
    status: "pending" | "completed" | "rejected";
    notificationId: string;
    title: string;
    body: string;
    emailRequested: boolean;
    pushRequested: boolean;
  }
): Promise<AdminUserNotificationRow> {
  const response = await fetch(`${serviceConfig.supabaseUrl}/rest/v1/rpc/review_race_request_with_notification`, {
    method: "POST",
    headers: serviceHeaders(serviceConfig),
    body: JSON.stringify({
      p_request_id: input.requestId,
      p_admin_id: input.adminId,
      p_status: input.status,
      p_notification_id: input.notificationId,
      p_title: input.title,
      p_body: input.body,
      p_email_requested: input.emailRequested,
      p_push_requested: input.pushRequested,
    }),
  });
  if (!response.ok) throw new Error(`Unable to review race request: ${await response.text()}`);
  return parseNotification(await response.json());
}

export async function reviewAppFeedbackWithNotification(
  serviceConfig: SupabaseServiceConfig,
  input: {
    feedbackId: number;
    adminId: string;
    status: "pending" | "completed" | "rejected";
    notificationId: string;
    title: string;
    body: string;
    emailRequested: boolean;
    pushRequested: boolean;
  }
): Promise<AdminUserNotificationRow> {
  const response = await fetch(`${serviceConfig.supabaseUrl}/rest/v1/rpc/review_app_feedback_with_notification`, {
    method: "POST",
    headers: serviceHeaders(serviceConfig),
    body: JSON.stringify({
      p_feedback_id: input.feedbackId,
      p_admin_id: input.adminId,
      p_status: input.status,
      p_notification_id: input.notificationId,
      p_title: input.title,
      p_body: input.body,
      p_email_requested: input.emailRequested,
      p_push_requested: input.pushRequested,
    }),
  });
  if (!response.ok) throw new Error(`Unable to review feedback: ${await response.text()}`);
  return parseNotification(await response.json());
}

async function updateDelivery(
  serviceConfig: SupabaseServiceConfig,
  notificationId: string,
  patch: Record<string, unknown>
) {
  const response = await fetch(
    `${serviceConfig.supabaseUrl}/rest/v1/user_notifications?id=eq.${encodeURIComponent(notificationId)}`,
    {
      method: "PATCH",
      headers: { ...serviceHeaders(serviceConfig), Prefer: "return=minimal" },
      body: JSON.stringify(patch),
    }
  );
  if (!response.ok) throw new Error(`Unable to store notification delivery result: ${await response.text()}`);
}

export async function deliverAdminUserNotification(
  serviceConfig: SupabaseServiceConfig,
  notification: AdminUserNotificationRow
) {
  const patch: Record<string, unknown> = {};
  const shouldDeliverEmail = notification.email_requested
    && notification.email_status !== "sent"
    && notification.email_status !== "unavailable";
  const shouldDeliverPush = notification.push_requested
    && notification.push_status !== "sent"
    && notification.push_status !== "unavailable";
  const authUserPromise = shouldDeliverEmail
    ? fetchAdminAuthUser(serviceConfig, notification.user_id)
    : Promise.resolve(null);
  const emailPromise = authUserPromise.then(async (user) => {
    if (!shouldDeliverEmail) return null;
    if (!user?.email) return { status: "unavailable" as const, error: "No email address is available." };
    const result = await sendAdminUserNotificationEmail({
      to: user.email,
      notificationId: notification.id,
      title: notification.title,
      body: notification.body,
    });
    if (result.status === "sent") return { status: "sent" as const, providerId: result.id ?? null };
    if (result.status === "skipped") return { status: "unavailable" as const, error: result.reason };
    return { status: "failed" as const, error: result.message };
  });
  const pushPromise = shouldDeliverPush
    ? sendAdminUserNotificationPush({
        userId: notification.user_id,
        notificationId: notification.id,
        title: notification.title,
        body: notification.body,
      })
    : Promise.resolve(null);

  const [emailResult, pushResult] = await Promise.allSettled([emailPromise, pushPromise]);
  if (shouldDeliverEmail) {
    if (emailResult.status === "fulfilled" && emailResult.value) {
      patch.email_status = emailResult.value.status;
      patch.email_provider_id = "providerId" in emailResult.value ? emailResult.value.providerId : null;
      patch.email_error = "error" in emailResult.value ? emailResult.value.error?.slice(0, 1000) ?? null : null;
    } else {
      patch.email_status = "failed";
      patch.email_error = emailResult.status === "rejected" ? String(emailResult.reason).slice(0, 1000) : "Unknown error";
    }
  }
  if (shouldDeliverPush) {
    if (pushResult.status === "fulfilled" && pushResult.value) {
      patch.push_sent_count = Math.max(
        notification.push_sent_count,
        pushResult.value.sentCount + pushResult.value.skippedDuplicateCount
      );
      patch.push_status = pushResult.value.totalCandidateCount === 0
        ? "unavailable"
        : pushResult.value.sentCount > 0 || pushResult.value.skippedDuplicateCount > 0
          ? "sent"
          : "failed";
      patch.push_error = patch.push_status === "failed" ? "Expo did not accept any notification." : null;
    } else {
      patch.push_status = "failed";
      patch.push_error = pushResult.status === "rejected" ? String(pushResult.reason).slice(0, 1000) : "Unknown error";
    }
  }
  if (Object.keys(patch).length > 0) await updateDelivery(serviceConfig, notification.id, patch);
  return patch;
}
