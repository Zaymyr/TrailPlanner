import { useQuery } from "@tanstack/react-query";
import { z } from "zod";

import { adminFetch, instagramStatusSchema } from "../../publications/publications-api";

const runnerModeSchema = z.object({ mode: z.enum(["real", "free", "premium"]).catch("real") });

/** Instagram status refreshes at most every 5 min: each read calls the Graph API (profile and quota). */
const INSTAGRAM_STALE_MS = 5 * 60_000;

/**
 * Test modes shown in the top bar: Instagram dry run (`GET /api/admin/instagram` → `dryRun`, same query
 * key as Publications, so both share one cache entry) and the runner-access simulation of this session
 * (`GET /api/admin/runner-access-mode`, set on /profile).
 */
export function useAdminModes(accessToken: string | null) {
  const instagram = useQuery({
    queryKey: ["admin", "instagram-status", accessToken],
    enabled: Boolean(accessToken),
    staleTime: INSTAGRAM_STALE_MS,
    queryFn: () => adminFetch(accessToken as string, "/api/admin/instagram", instagramStatusSchema, {}, "Le compte Instagram n’a pas pu être lu."),
  });
  const runner = useQuery({
    queryKey: ["admin", "runner-access-mode", accessToken],
    enabled: Boolean(accessToken),
    staleTime: 60_000,
    queryFn: () => adminFetch(accessToken as string, "/api/admin/runner-access-mode", runnerModeSchema, {}, "Le mode de test n’a pas pu être lu."),
  });
  return {
    instagramDryRun: instagram.data?.dryRun ?? null,
    runnerMode: runner.data?.mode ?? null,
  };
}

export const RUNNER_MODE_LABELS = { free: "Gratuit", premium: "Premium" } as const;
