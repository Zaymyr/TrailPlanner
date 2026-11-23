"use client";

import { useQuery } from "@tanstack/react-query";
import { useEffect } from "react";

import { adminRendersResponseSchema, rendersPollInterval, writeRendersQuery, type RendersQuery } from "../../../../lib/admin-renders";
import { adminFetch } from "../../publications/publications-api";

/**
 * Render queue of `/admin/content/renders` (`GET /api/admin/renders`), one cache entry per query.
 * Refreshed every 5 s while a render is waiting or running, once a minute otherwise.
 */
export function useAdminRenders(accessToken: string, query: RendersQuery | null) {
  const search = query ? writeRendersQuery(query).toString() : "";
  const enabled = query !== null && Boolean(accessToken);
  const result = useQuery({
    enabled,
    queryKey: ["admin", "renders", accessToken, search],
    queryFn: () => adminFetch(accessToken, `/api/admin/renders${search ? `?${search}` : ""}`, adminRendersResponseSchema, {}, "Les rendus n’ont pas pu être lus."),
  });
  const refetch = result.refetch;
  const hasActive = (result.data?.activeCount ?? 0) > 0;
  useEffect(() => {
    if (!enabled) return;
    const timer = window.setInterval(() => void refetch(), rendersPollInterval(hasActive));
    return () => window.clearInterval(timer);
  }, [enabled, hasActive, refetch]);
  return result;
}
