import { z } from "zod";

import {
  AUDIT_COLUMNS,
  AUDIT_EXPORT_LIMIT,
  AUDIT_PAGE_SIZE,
  auditFilters,
  auditRowSchema,
  mapAuditRow,
  type AuditEntry,
  type AuditQuery,
  type AuditResponse,
} from "./admin-audit";
import { getServiceResponse, settleSource, type ServiceReadError } from "./admin-service-rest";
import { loadAdminUserIdentities } from "./admin-user-notifications";
import { addDays } from "./reel-planner";
import { parisLocalToUtc } from "./social-posts";
import type { SupabaseServiceConfig } from "./supabase";

/**
 * Loader of `GET /api/admin/audit` (Système › Journal): one page of `admin_audit_log`, newest first,
 * with the actor names (profile name, else masked e-mail written with the line) and the list of the
 * recent actors for the filter chips. Read-only; the read itself is never journaled.
 */

const parisMidnightIso = (day: string) => (parisLocalToUtc(`${day}T00:00`) ?? new Date(`${day}T00:00:00Z`)).toISOString();

const maskEmail = (email: string | null | undefined) => {
  const value = email?.trim().toLowerCase() ?? "";
  const at = value.lastIndexOf("@");
  if (at < 1) return null;
  const local = value.slice(0, at);
  return `${local.length <= 2 ? local.slice(0, 1) : local.slice(0, 2)}***@${value.slice(at + 1)}`;
};

const actorNames = async (supabase: SupabaseServiceConfig, userIds: string[]): Promise<Map<string, string>> => {
  const identities = await settleSource(loadAdminUserIdentities(supabase, userIds), "Audit actor identities");
  const names = new Map<string, string>();
  if (!identities) return names;
  for (const userId of new Set(userIds)) {
    const name = identities.names.get(userId)?.trim() || maskEmail(identities.emails.get(userId));
    if (name) names.set(userId, name);
  }
  return names;
};

export const loadAdminAudit = async (supabase: SupabaseServiceConfig, query: AuditQuery, { exportAll = false }: { exportAll?: boolean } = {}): Promise<AuditResponse> => {
  const filters = auditFilters(query, {
    fromIso: query.from ? parisMidnightIso(query.from) : null,
    toIso: query.to ? parisMidnightIso(addDays(query.to, 1)) : null,
  });
  const pageSize = exportAll ? AUDIT_EXPORT_LIMIT : AUDIT_PAGE_SIZE;
  const offset = exportAll ? 0 : (query.page - 1) * AUDIT_PAGE_SIZE;
  const path = [`admin_audit_log?select=${AUDIT_COLUMNS}`, ...filters, "order=created_at.desc,id.desc", `limit=${pageSize}`, `offset=${offset}`].join("&");

  let response: Response;
  try {
    response = await getServiceResponse(supabase, path, { Prefer: "count=exact" });
  } catch (error) {
    // The table does not exist until the lot 7 migration is applied.
    if ((error as ServiceReadError).status === 404) {
      return { generatedAt: new Date().toISOString(), available: false, entries: [], actors: [], pagination: { page: 1, pageSize: AUDIT_PAGE_SIZE, total: 0, totalPages: 1 } };
    }
    throw error;
  }
  const rows = z.array(auditRowSchema).parse(await response.json());
  const total = Number(response.headers.get("content-range")?.split("/")[1] ?? rows.length) || rows.length;

  const recentActors = exportAll || query.entryId
    ? null
    : await settleSource(
        getServiceResponse(supabase, "admin_audit_log?select=actor_user_id&order=created_at.desc&limit=500").then(async (result) =>
          z.array(z.object({ actor_user_id: z.string() })).parse(await result.json())),
        "Audit actors",
      );
  const actorIds = [...new Set([...rows.map((row) => row.actor_user_id), ...(recentActors ?? []).map((row) => row.actor_user_id)])];
  const names = await actorNames(supabase, actorIds);
  const entries: AuditEntry[] = rows.map((row) => mapAuditRow(row, names.get(row.actor_user_id)));
  const labelByActor = new Map(rows.filter((row) => row.actor_label).map((row) => [row.actor_user_id, row.actor_label as string]));

  return {
    generatedAt: new Date().toISOString(),
    available: true,
    entries,
    actors: [...new Set((recentActors ?? []).map((row) => row.actor_user_id))].map((id) => ({
      id,
      name: names.get(id) ?? labelByActor.get(id) ?? `Admin ${id.slice(0, 8)}`,
    })),
    pagination: { page: query.page, pageSize: AUDIT_PAGE_SIZE, total, totalPages: Math.max(1, Math.ceil(total / AUDIT_PAGE_SIZE)) },
  };
};

/** The latest important admin actions, for the activity feed of the overview (never throws). */
export const loadRecentAdminActions = async (supabase: SupabaseServiceConfig, actions: string[], limit = 8): Promise<AuditEntry[]> => {
  const clauses = actions.map((action) => `action.eq.${action}`).join(",");
  const path = `admin_audit_log?select=${AUDIT_COLUMNS}&or=(${clauses},status.eq.error)&order=created_at.desc&limit=${limit}`;
  try {
    const rows = z.array(auditRowSchema).parse(await (await getServiceResponse(supabase, path)).json());
    const names = await actorNames(supabase, rows.map((row) => row.actor_user_id));
    return rows.map((row) => mapAuditRow(row, names.get(row.actor_user_id)));
  } catch (error) {
    // Before the lot 7 migration is applied the table does not exist: no admin action to show, not an error.
    if ((error as ServiceReadError).status === 404) return [];
    throw error;
  }
};
