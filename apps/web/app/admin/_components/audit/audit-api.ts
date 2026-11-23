import { useQuery } from "@tanstack/react-query";

import { auditResponseSchema, writeAuditQuery, type AuditQuery } from "../../../../lib/admin-audit";
import { adminFetch } from "../../publications/publications-api";

/** Journal page (`GET /api/admin/audit`), one cache entry per query (the URL of the page). */
export function useAdminAudit(accessToken: string, query: AuditQuery | null) {
  const search = query ? writeAuditQuery({ ...query, entryId: null }).toString() : "";
  return useQuery({
    enabled: query !== null && Boolean(accessToken),
    queryKey: ["admin", "audit", accessToken, search],
    staleTime: 15_000,
    queryFn: () => adminFetch(accessToken, `/api/admin/audit${search ? `?${search}` : ""}`, auditResponseSchema, {}, "Le journal n’a pas pu être lu."),
  });
}

/** One line by id (`?entree=`), for a shared link to a line the current page does not hold. */
export function useAdminAuditEntry(accessToken: string, entryId: string | null, enabled: boolean) {
  return useQuery({
    enabled: enabled && Boolean(entryId) && Boolean(accessToken),
    queryKey: ["admin", "audit", "entry", accessToken, entryId],
    staleTime: 60_000,
    queryFn: () => adminFetch(accessToken, `/api/admin/audit?entree=${encodeURIComponent(entryId ?? "")}`, auditResponseSchema, {}, "Cette entrée n’a pas pu être lue."),
  });
}

/** Every matching line of the current view, for the CSV export. */
export const fetchAuditExport = (accessToken: string, query: AuditQuery) => {
  const params = writeAuditQuery({ ...query, page: 1, entryId: null });
  params.set("export", "1");
  return adminFetch(accessToken, `/api/admin/audit?${params.toString()}`, auditResponseSchema, {}, "L’export n’a pas pu être préparé.");
};
