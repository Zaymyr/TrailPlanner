import { useQuery } from "@tanstack/react-query";

import { adminOverviewResponseSchema } from "../../../../lib/admin-overview";
import { adminFetch } from "../../publications/publications-api";
import { overviewApiQuery, type OverviewPeriod } from "./overview-period";

/** `GET /api/admin/overview` for a period (one cache entry per period). */
export function useAdminOverview(accessToken: string, period: OverviewPeriod) {
  const query = overviewApiQuery(period);
  return useQuery({
    queryKey: ["admin", "overview", accessToken, query],
    staleTime: 60_000,
    queryFn: () => adminFetch(accessToken, `/api/admin/overview?${query}`, adminOverviewResponseSchema, {}, "La vue d’ensemble n’a pas pu être chargée."),
  });
}
