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
  // System items of the « À traiter » queue (lot 2); null when the count could not be read.
  failedFlyovers: z.number().nullable().default(null),
  failedPosts: z.number().nullable().default(null),
  draftPosts: z.number().nullable().default(null),
  failedRenders: z.number().nullable().default(null),
  systemTotal: z.number().default(0),
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

/**
 * Counts of the console: messages (bugs, feedback, race and demo requests), organizer requests, system
 * items (failed flyovers, posts and renders, drafts to review) and their total (« À traiter », bell).
 * Same definition as the counted types of the queue (`lib/admin-inbox.ts`); « Données de course » is
 * listed in the queue but not counted.
 */
export const inboxTotals = (counts: InboxCounts | undefined) => {
  if (!counts) return { messages: undefined, organizers: undefined, system: undefined, total: undefined };
  const messages = counts.bug + counts.feedback + counts.raceRequests + counts.demoRequests;
  return { messages, organizers: counts.organizerTotal, system: counts.systemTotal, total: messages + counts.organizerTotal + counts.systemTotal };
};
