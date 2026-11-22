import { useQuery } from "@tanstack/react-query";

import { integrationsResponseSchema } from "../../../../lib/admin-integrations";
import { systemHealthResponseSchema } from "../../../../lib/admin-system-health";
import { adminFetch } from "../../publications/publications-api";

/** Santé des systèmes (`GET /api/admin/system/health`), shared by Automatisations and Maintenance. */
export function useSystemHealth(accessToken: string) {
  return useQuery({
    queryKey: ["admin", "system-health", accessToken],
    staleTime: 30_000,
    queryFn: () => adminFetch(accessToken, "/api/admin/system/health", systemHealthResponseSchema, {}, "La santé des systèmes n’a pas pu être lue."),
  });
}

/** Intégrations (`GET /api/admin/system/integrations`): presence of each variable, never a value. */
export function useIntegrations(accessToken: string) {
  return useQuery({
    queryKey: ["admin", "system-integrations", accessToken],
    staleTime: 30_000,
    queryFn: () => adminFetch(accessToken, "/api/admin/system/integrations", integrationsResponseSchema, {}, "Les intégrations n’ont pas pu être lues."),
  });
}

export const errorMessage = (error: unknown, fallback: string) => (error instanceof Error && error.message ? error.message : fallback);

const absoluteFormat = new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium", timeStyle: "short", timeZone: "Europe/Paris" });
/** « 23 nov. 2026, 10:17 » (Paris). */
export const formatAbsolute = (iso: string) => absoluteFormat.format(new Date(iso));
