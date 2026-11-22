import { useQuery } from "@tanstack/react-query";
import { z } from "zod";

export const inboxCountsSchema = z.object({
  bug: z.number(),
  feedback: z.number(),
  raceRequests: z.number(),
  demoRequests: z.number().default(0),
  organizerClaims: z.number().default(0),
  publicationRequests: z.number().default(0),
  editionRequests: z.number().default(0),
  organizerTotal: z.number().default(0),
});
export type InboxCounts = z.infer<typeof inboxCountsSchema>;

/** Pending counts of the admin inbox; one query key shared by the Messagerie and Organisateurs badges. */
export function useInboxCounts(accessToken: string | null) {
  return useQuery({
    queryKey: ["admin", "inbox-counts", accessToken],
    enabled: Boolean(accessToken),
    staleTime: 30_000,
    queryFn: async () => {
      const response = await fetch("/api/admin/inbox-counts", {
        headers: { Authorization: `Bearer ${accessToken}` },
        cache: "no-store",
      });
      if (!response.ok) throw new Error("Impossible de compter les messages.");
      return inboxCountsSchema.parse(await response.json());
    },
  });
}

export const withCount = (label: string, count: number | undefined) => (count ? `${label} (${count})` : label);
