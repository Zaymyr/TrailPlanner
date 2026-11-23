import { useQuery } from "@tanstack/react-query";

import { inboxResponseSchema } from "../../../../lib/admin-inbox";
import { adminFetch } from "../../publications/publications-api";

/** The « À traiter » queue (`GET /api/admin/inbox`); one cache entry shared by the dashboard card and /admin/inbox. */
export function useAdminInbox(accessToken: string) {
  return useQuery({
    queryKey: ["admin", "inbox", accessToken],
    staleTime: 60_000,
    queryFn: () => adminFetch(accessToken, "/api/admin/inbox", inboxResponseSchema, {}, "La file « À traiter » n’a pas pu être lue."),
  });
}
