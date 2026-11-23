import { z } from "zod";

import {
  ADMIN_MESSAGE_COLUMNS,
  ADMIN_MESSAGES_PAGE_SIZE,
  adminMessageRowSchema,
  adminMessagesFilter,
  mapAdminMessage,
  type AdminMessagesQuery,
  type AdminMessagesResponse,
} from "./admin-messages";
import { getServiceJson, getServiceResponse } from "./admin-service-rest";
import { loadAdminUserIdentities } from "./admin-user-notifications";
import type { SupabaseServiceConfig } from "./supabase";

/**
 * Loader of `GET /api/admin/user-notifications` (Communication › Messages & notifications): one page
 * of `user_notifications`, newest first, filtered with `adminMessagesFilter`, with the recipient name
 * and e-mail of the page's rows (Auth admin API) and the kind of the bug / feedback a reply answers.
 */
export const loadAdminMessages = async (supabase: SupabaseServiceConfig, query: AdminMessagesQuery): Promise<AdminMessagesResponse> => {
  const offset = (query.page - 1) * ADMIN_MESSAGES_PAGE_SIZE;
  const path = [
    `user_notifications?select=${ADMIN_MESSAGE_COLUMNS}`,
    ...adminMessagesFilter(query),
    "order=created_at.desc",
    `limit=${ADMIN_MESSAGES_PAGE_SIZE}`,
    `offset=${offset}`,
  ].join("&");
  const response = await getServiceResponse(supabase, path, { Prefer: "count=exact" });
  const rows = z.array(adminMessageRowSchema).parse(await response.json());
  const total = Number(response.headers.get("content-range")?.split("/")[1] ?? rows.length) || rows.length;

  const feedbackIds = [...new Set(rows.map((row) => row.feedback_id).filter((id): id is number => typeof id === "number"))];
  const [identities, feedbackKinds] = await Promise.all([
    loadAdminUserIdentities(supabase, rows.map((row) => row.user_id)).catch(() => ({ names: new Map<string, string | null>(), emails: new Map<string, string | null>() })),
    feedbackIds.length
      ? getServiceJson(supabase, `app_feedback?id=in.(${feedbackIds.join(",")})&select=id,kind`)
        .then((payload) => new Map(z.array(z.object({ id: z.coerce.number().int(), kind: z.enum(["bug", "feedback"]) })).parse(payload).map((item) => [item.id, item.kind])))
        .catch(() => new Map<number, "bug" | "feedback">())
      : Promise.resolve(new Map<number, "bug" | "feedback">()),
  ]);

  return {
    messages: rows.map((row) => mapAdminMessage(
      row,
      { name: identities.names.get(row.user_id) ?? null, email: identities.emails.get(row.user_id) ?? null },
      row.feedback_id ? feedbackKinds.get(row.feedback_id) ?? null : null,
    )),
    pagination: {
      page: query.page,
      pageSize: ADMIN_MESSAGES_PAGE_SIZE,
      total,
      totalPages: Math.max(1, Math.ceil(total / ADMIN_MESSAGES_PAGE_SIZE)),
    },
  };
};
